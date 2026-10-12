// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import AudioUnlock from "./AudioUnlock";
import CopticFontPreference from "./CopticFontPreference";
import MobileChinDock from "./MobileChinDock";
import ThemePreference, { themeInitScript } from "./ThemePreference";

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
        <AudioUnlock />
        <CopticFontPreference />
        <ThemePreference />
        <div className="mobile-chin-page-shell">{children}</div>
        <MobileChinDock />
      </body>
    </html>
  );
}
