import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: { default: "Gauge", template: "%s | Gauge" },
  description: "Gauge your API spend. Detect vendors, track usage, cut costs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('gauge-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
