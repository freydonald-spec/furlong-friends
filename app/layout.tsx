import type { Metadata, Viewport } from "next";
import { Geist, Playfair_Display, Press_Start_2P } from "next/font/google";
import "./globals.css";

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
};

export const viewport: Viewport = {
  themeColor: "#F8F9FA",
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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
