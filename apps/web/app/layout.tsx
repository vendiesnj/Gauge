import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Gauge", template: "%s | Gauge" },
  description: "Gauge your API spend. Detect vendors, track usage, cut costs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
