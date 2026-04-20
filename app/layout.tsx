import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { UserProvider } from "@/context/UserContext";
import { ApiClientInit } from "@/components/ApiClientInit";

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
    <html
      lang="en"
      data-theme="nfws"
      suppressHydrationWarning
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body
        className="bg-bg-primary text-text-primary"
        style={{ backgroundColor: "#0a0a0a", minHeight: "100dvh" }}
      >
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
