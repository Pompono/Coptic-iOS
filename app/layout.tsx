// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import AudioUnlock from "./AudioUnlock";
import CopticFontPreference from "./CopticFontPreference";
import MobileChinDock from "./MobileChinDock";
import ThemePreference, { themeInitScript } from "./ThemePreference";
import NavigationScrollReset from './NavigationScrollReset';
import AppViewport from './AppViewport';

export const metadata: Metadata = {
  title: "Coptic",
  description: "Coptic learning + dictionary",
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
        <div className="status-bar-backdrop" aria-hidden="true" />
        <AudioUnlock />
        <CopticFontPreference />
        <ThemePreference />
        <NavigationScrollReset />
        <AppViewport>{children}</AppViewport>
        <MobileChinDock />
      </body>
    </html>
  );
}
