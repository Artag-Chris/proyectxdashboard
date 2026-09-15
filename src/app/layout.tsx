import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Atiende Dashboard",
  description: "Dashboard de administración para Atiende",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fafafa",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="h-full bg-zinc-50 font-sans antialiased text-zinc-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
