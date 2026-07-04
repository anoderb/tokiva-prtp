import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/bottom-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tokiva — AI Kasir POS",
  description: "Prototype POS Kasir Pintar dengan Deteksi Kamera",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tokiva POS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents auto-zoom on mobile inputs
  viewportFit: "cover", // Fits notch safe areas
  themeColor: "#09090b", // Custom browser header color matching dark zinc-950
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-100 flex flex-col font-sans">
        {/* Mobile Viewport Container wrapper */}
        <div className="flex-1 w-full max-w-md mx-auto bg-zinc-950 min-h-screen shadow-2xl border-x border-zinc-900 flex flex-col relative pb-20">
          <main className="flex-1 flex flex-col px-4 pt-4 overflow-y-auto no-scrollbar">
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
