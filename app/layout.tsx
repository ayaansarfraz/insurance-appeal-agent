import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter, Newsreader } from 'next/font/google';
import './globals.css';

/** Three faces, three jobs: serif for statements the reader is meant to weigh,
 *  sans for interface copy, mono reserved exclusively for data that carries a
 *  citation. The mono face is how a value reads as verifiable rather than
 *  editorial, so do not use it for prose. */
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wildfire Insurance Appeal Agent',
  description:
    'Checks an insurer stated non-renewal reason against parcel level physical data and the recorded California fire history for that exact parcel, then drafts a cited appeal.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${inter.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
