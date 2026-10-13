"use client";

type AudioContextConstructor = new () => AudioContext;
type AudioSessionType = "auto" | "ambient" | "playback" | "play-and-record" | "transient" | "transient-solo";

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor;
  };

type AudioSessionNavigator = Navigator & {
  audioSession?: {
    type: AudioSessionType;
  };
};

class AudioService {
  private ctx: AudioContext | null = null;
  private cache = new Map<string, Promise<AudioBuffer>>();
  private activeSources = new Set<AudioBufferSourceNode>();
  private unlockPromise: Promise<void> | null = null;

  private getContextConstructor(): AudioContextConstructor {
    if (typeof window === "undefined") {
      throw new Error("Web Audio is only available in the browser.");
    }

    const webAudioWindow = window as WebAudioWindow;
    const AudioContextClass = webAudioWindow.AudioContext ?? webAudioWindow.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio is not supported in this browser.");
    }

    return AudioContextClass;
  }

  private applyPlaybackAudioSessionType() {
    if (typeof navigator === "undefined") {
      return;
    }

    const audioSession = (navigator as AudioSessionNavigator).audioSession;
    if (!audioSession) {
      return;
    }

    try {
      if (audioSession.type !== "playback") {
        audioSession.type = "playback";
      }
    } catch {
      // Best-effort only. Unsupported browsers should keep working.
    }
  }

  init() {
    this.applyPlaybackAudioSessionType();

    if (!this.ctx || this.ctx.state === "closed") {
      const AudioContextClass = this.getContextConstructor();
      this.ctx = new AudioContextClass();
    }

    return this.ctx;
  }

  async resume() {
    this.applyPlaybackAudioSessionType();
    const ctx = this.init();
    if (ctx.state !== "running") {
      await ctx.resume();
    }
    return ctx;
  }

  async unlock() {
    if (!this.unlockPromise) {
      this.unlockPromise = this.performUnlock().catch((error) => {
        this.unlockPromise = null;
        throw error;
      });
    }

    return this.unlockPromise;
  }

  private async performUnlock() {
    const ctx = await this.resume();
    const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    gain.gain.value = 0;
    source.buffer = silentBuffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    await new Promise<void>((resolve) => {
      source.onended = () => {
        try {
          source.disconnect();
        } catch {}

        try {
          gain.disconnect();
        } catch {}

        resolve();
      };
      source.start(0);
    });
  }

  async preload(key: string, url = key) {
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const pendingBuffer = (async () => {
      const ctx = await this.init();
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${url}`);
      }

      const data = await response.arrayBuffer();
      return new Promise<AudioBuffer>((resolve, reject) => {
        const decodePromise = ctx.decodeAudioData(data.slice(0), resolve, reject);
        if (decodePromise && typeof decodePromise.then === "function") {
          decodePromise.then(resolve).catch(reject);
        }
      });
    })().catch((error) => {
      this.cache.delete(key);
      throw error;
    });

    this.cache.set(key, pendingBuffer);
    return pendingBuffer;
  }

  async preloadMany(entries: Array<{ key: string; url: string }>) {
    await Promise.all(entries.map(({ key, url }) => this.preload(key, url)));
  }

  async play(key: string, url = key) {
    const ctx = await this.resume();
    const buffer = await this.preload(key, url);
    // Loading may overlap an interruption or background/foreground transition.
    if (ctx.state !== "running") await ctx.resume();
    const source = ctx.createBufferSource();

    source.buffer = buffer;
    source.connect(ctx.destination);
    this.activeSources.add(source);

    source.onended = () => {
      this.activeSources.delete(source);
      try {
        source.disconnect();
      } catch {}
    };

    source.start(0);
    return source;
  }

  stopAll() {
    for (const source of this.activeSources) {
      source.onended = null;
      try {
        source.stop();
      } catch {}

      try {
        source.disconnect();
      } catch {}
    }

    this.activeSources.clear();
  }

  async pause() {
    this.stopAll();
    this.unlockPromise = null;
    if (this.ctx?.state === "running") {
      await this.ctx.suspend();
    }
  }
}

export const audioService = new AudioService();
