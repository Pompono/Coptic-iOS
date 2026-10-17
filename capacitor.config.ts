import {KeyboardResize} from '@capacitor/keyboard';
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pompono.coptic',
  appName: 'Coptic',
  webDir: 'out',
  // Capacitor's bridge can log plugin results, including translated text.
  loggingBehavior: 'none',
  plugins: { Keyboard: { resize: KeyboardResize.None } },
  ios: { contentInset: 'never', zoomEnabled: false },
};

export default config;
