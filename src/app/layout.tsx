import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BarraProgresso from "@/components/BarraProgresso";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestão de Condomínio",
  description:
    "Sistema de cadastro de condomínios, unidades e leituras de água e gás.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <BarraProgresso />
        {children}
      </body>
    </html>
  );
}
