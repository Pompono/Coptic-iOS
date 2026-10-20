// app/layout.tsx
import "./globals.css";
import "./design-system.css";
import type { Metadata, Viewport } from "next";
import KeyboardInstallPrompt from "./KeyboardInstallPrompt";
import NativeExperience from "./NativeExperience";
import AudioUnlock from "./AudioUnlock";
import CopticFontPreference from "./CopticFontPreference";
import MobileChinDock from "./MobileChinDock";
import ThemePreference, { themeInitScript } from "./ThemePreference";
import NavigationScrollReset from './NavigationScrollReset';
import ProgressStorageNotice from "./ProgressStorageNotice";
import AppViewport from './AppViewport';
import AuthProvider from './AuthProvider';
import ProgressSyncLifecycle from './ProgressSyncLifecycle';

export const metadata: Metadata = {
  title: "CoptLingo",
  applicationName: "CoptLingo",
  description: "Learn Coptic with guided lessons, a dictionary, reading practice, and translation tools.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AuthProvider>
          <ProgressSyncLifecycle />
          <div className="status-bar-backdrop" aria-hidden="true" />
          <AudioUnlock />
          <NativeExperience />
          <CopticFontPreference />
          <ThemePreference />
          <NavigationScrollReset />
          <AppViewport><ProgressStorageNotice />{children}</AppViewport>
          <MobileChinDock />
          <KeyboardInstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
