import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pompono.coptic',
  appName: 'Coptic',
  webDir: 'out',
  ios: { contentInset: 'never', zoomEnabled: false },
};

export default config;
