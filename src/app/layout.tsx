import type { Metadata } from "next";
import { Geist_Mono, Inter, Noto_Sans_TC } from "next/font/google";

import { StudioShell } from "@/components/studio/app-shell";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoSansTc = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dreamy Sky Creator Console",
  description: "AI story-to-video creator console for scripts, assets, images, and render queues.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${inter.variable} ${notoSansTc.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <StudioShell>{children}</StudioShell>
      </body>
    </html>
  );
}
