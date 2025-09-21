import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LightLeakBackground from "@/components/LightLeakBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduGo",
  description: "Empowering Education Through Technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Animated Background - Always behind everything */}
        <LightLeakBackground />
        
        {/* Navbar should be inside body */}
        <Navbar />
        
        <main className="pt-16 relative z-10">
          {/* Add padding so content isn't hidden under fixed navbar */}
          {children}
        </main>
      </body>
    </html>
  );
}