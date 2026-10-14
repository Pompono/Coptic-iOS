"use client";
import { audioService, reportAudioFailure } from '@/lib/audioService';
import type { CSSProperties } from 'react';

export function PlaybackIcon({ slow = false, size = 32 }: { slow?: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 36 28" fill="currentColor" aria-hidden="true" focusable="false">
    {slow ? <><path d="M3 16a9 9 0 0 1 18 0H3Z"/><path d="M5 18h13l3-3h3a3 3 0 0 0 0-6 3 3 0 0 0-3 3v1l-4 3H3v2h2l-1 4h3l2-4h5l2 4h3l-1-4Z"/><path d="M9 8v7m6-7v7" fill="none" stroke="var(--surface-1)" strokeWidth="1" opacity=".65"/></> : <path d="M3 10h5l8-6v20l-8-6H3Z"/>}
    <g fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d={slow?'M27 10q4 4 0 8':'M21 10q4 4 0 8'}/><path d={slow?'M30 6q7 8 0 16':'M25 6q7 8 0 16'}/></g>
  </svg>;
}

/** Both speeds play the same human recording; captions remain available to VoiceOver. */
export default function AudioReplay({ path, onPlay, card = false }: { path?: string; onPlay?:()=>void; card?:boolean }) {
  if (!path) return null;
  return <div className="audio-replay" role="group" aria-label="Recording playback">
    <button type="button" className={card?'lesson-audio-card':undefined} aria-label="Play recording" onClick={onPlay??(()=>void audioService.play(path,path,1).catch(reportAudioFailure))}><PlaybackIcon/></button>
    <button type="button" aria-label="Play recording slowly" onClick={()=>void audioService.play(path,path,.75).catch(reportAudioFailure)}><PlaybackIcon slow/></button>
  </div>;
}

export function RecordingCard({path,label,coptic,onPlay,style,fontSize}: {path?:string;label:string|null;coptic:boolean;onPlay:()=>void;style:CSSProperties;fontSize:number}) {
  return <div className={`recording-card ${label?'has-label':'is-listening'}`} style={style}>
    {label&&<button type="button" className="lesson-audio-card recording-card__label" onClick={onPlay}><span className={coptic?'coptic-text':undefined} style={{fontSize}}>{label}</span></button>}
    <AudioReplay path={path} onPlay={onPlay} card={!label}/>
  </div>;
}
