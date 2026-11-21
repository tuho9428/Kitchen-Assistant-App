import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { OfflineProvider } from "@/components/offline/provider";
import { TimerProvider } from "@/components/timers/provider";
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
        <OfflineProvider>
          <TimerProvider>{children}</TimerProvider>
        </OfflineProvider>
      </body>
    </html>
  );
}
