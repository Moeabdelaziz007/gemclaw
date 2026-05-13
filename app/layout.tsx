import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';
import AppShell from '@/components/AppShell';
import { ActiveIntelligence } from '@/components/ActiveIntelligence';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Gemclaw',
  description: 'The Voice-Native AI Social Nexus.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#050B14" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/aether-entity.png" />
        {/* Pre-hydration theme injection to prevent FOUT */}
        <Script
          id="theme-strategy"
          src="/scripts/theme-init.js"
          strategy="beforeInteractive"
        />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased selection:bg-aether-neon/30 overflow-x-hidden bg-theme-primary text-theme-primary">
        <div className="fixed inset-0 pointer-events-none hud-grid opacity-10 z-[0]" />
        <Providers>
          <AppShell>
            <main className="relative z-[1]">
              {children}
            </main>
            <ActiveIntelligence />
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
