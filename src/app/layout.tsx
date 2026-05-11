import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { OAuthDeepLinkHandler } from "@/components/auth/OAuthDeepLinkHandler";
import { AppBootstrapGate } from "@/components/bootstrap/AppBootstrapGate";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "guardDh",
  description: "Seguí tus bajadas, rutas y ranking",
  manifest: "/manifest.json"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        <ToastProvider>
          <AppBootstrapGate>
            <OAuthDeepLinkHandler />
            {children}
          </AppBootstrapGate>
        </ToastProvider>
      </body>
    </html>
  );
}
