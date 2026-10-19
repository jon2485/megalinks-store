import type { Metadata } from "next";
import "./globals.css";
import "./admin-reviewed-controls.css";
import "./customer-finance-glass.css";
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}<BrandLoading/></body>
    </html>
  );
}
