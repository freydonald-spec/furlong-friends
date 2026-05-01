import type { Metadata, Viewport } from "next";
import { Geist, Playfair_Display, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Furlong & Friends",
  description: "The Ultimate Derby Day Pick Em Game",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Furlong",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192x192.png",
  },
  other: {
    // Older Android Chrome still reads this name; appleWebApp.capable above
    // covers the iOS equivalent. Both are needed for the "installed app" feel.
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#C41E3A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Body inherits the light theme from globals.css (background: var(--bg-primary)).
  // Pages that want a dark splash background (/, /track) apply `bg-derby` on
  // their own <main> instead.
  return (
    <html lang="en" className={`${geistSans.variable} ${playfair.variable} ${pressStart.variable}`}>
      <body className="min-h-screen">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
