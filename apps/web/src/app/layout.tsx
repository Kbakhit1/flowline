import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const sans = IBM_Plex_Sans_Arabic({
  variable: "--font-sans",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const bp = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "مِرسال · Mirsal",
  description: "كل طلب في الشركة فقاعة واحدة. تنزل للفريق، وترجع بخبر.",
  manifest: `${bp}/manifest.webmanifest`,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mirsal" },
  icons: { icon: `${bp}/icon.svg`, apple: `${bp}/icon.svg` },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#131917" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
