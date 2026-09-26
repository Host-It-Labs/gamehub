import type { Metadata, Viewport } from 'next';
import './globals.css';
import { MobileViewport } from '@/components/game/mobile-viewport';
import { themeScript } from '@/lib/theme-script';
export const metadata: Metadata = {
  title: 'Gamehub — Your little corner of play',
  description:
    'Three original tabletop escapes. Play Nox, Mora, and Yata with tutorials and three bot levels.',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1b1713' },
    { color: '#f8f7f2' },
  ],
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <MobileViewport />
      </body>
    </html>
  );
}
