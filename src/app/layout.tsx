import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/design-system/components/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Luumu People", template: "%s · Luumu People" },
  description: "Plataforma de experiência, desenvolvimento e inteligência de pessoas.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-sidebar é aplicado antes da hidratação por /sidebar-init.js.
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- precisa rodar antes da pintura (evita salto da sidebar); arquivo mínimo do próprio domínio */}
        <script src="/sidebar-init.js" />
      </head>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
