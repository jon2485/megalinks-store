import type { Metadata } from "next";
import "./globals.css";
import "./approved-hebrew-font.css";
import "./admin-reviewed-controls.css";
import "./customer-finance-glass.css";
import "./approved-account.css";
import "./client-account-updates.css";
import FloatingWhatsApp from './floating-whatsapp';
import './floating-whatsapp.css';
import BrandLoading from './brand-loading';
import {SITE_URL,HOME_TITLE,HOME_DESCRIPTION,privateRobots} from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {default:HOME_TITLE,template:'%s | MegaLinks'},
  description: HOME_DESCRIPTION,
  applicationName: 'MegaLinks',
  robots: privateRobots,
  icons: {
    icon: {url:'/brand/loader-m.png',type:'image/png',sizes:'449x449'},
    shortcut: '/brand/loader-m.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preload" href="/brand/heebo-variable.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}<BrandLoading/><FloatingWhatsApp/></body>
    </html>
  );
}
