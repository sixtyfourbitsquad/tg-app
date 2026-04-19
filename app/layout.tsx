import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { UserProvider } from "@/context/UserContext";
import { ApiClientInit } from "@/components/ApiClientInit";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NFWS — Watch",
  description: "Discover trending videos",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="nfws" suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className={`${inter.variable} font-sans bg-bg-primary text-text-primary`}>
        <UserProvider>
          <ApiClientInit />
          <ToastProvider>
            <div className="app-container">{children}</div>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
