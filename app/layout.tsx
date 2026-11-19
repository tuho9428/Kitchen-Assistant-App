import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kitchen Prep · Lookup",
  description: "Shared ingredient lookup for the kitchen team",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
