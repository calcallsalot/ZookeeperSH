import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import localFont from "next/font/local";
import { Comfortaa } from "next/font/google";
import Providers from "./providers"; 

const comfortaa = Comfortaa({
  subsets: ["latin"],
  variable: "--font-comfortaa",
  display: "swap",
});

const eskapadeFraktur = localFont({
  src: "../public/fonts/EskapadeFraktur-Black.woff2",
  variable: "--font-eskapade-fraktur",
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZooKeeperSH.io",
  description: "Imitation of the classic Secret Hitler game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${comfortaa.variable} ${eskapadeFraktur.variable} antialiased`}>
        <Providers>{children}</Providers> 
      </body>
    </html>
  );
}
