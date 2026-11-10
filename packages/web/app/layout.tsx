import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Open Enrich - AI-Powered Lead Enrichment",
  description:
    "Enrich your leads with company data, funding info, tech stacks, and more using AI agents powered by Bright Data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrainsMono.variable} dark`}
    >
      <body className="min-h-screen bg-bg-deep text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
