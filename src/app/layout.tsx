import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './globals.css';
import { getActiveLang, getCurrentUser } from '@/server/auth/request';

export const metadata: Metadata = {
  title: 'Betterway OS — UAE Mortgage Operating System',
  description:
    'Proprietary UAE Mortgage Brokerage CRM, 24-Bank LOS, RERA Conveyancing, Double-Entry FTA ERP, MOHRE WPS HRM & CBUAE Compliance Operating System.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const lang = await getActiveLang(user);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={lang} dir={dir}>
      <body className="min-h-screen bg-[#F8F9FA] text-slate-900">{children}</body>
    </html>
  );
}
