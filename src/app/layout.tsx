import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { OAuthDeepLinkHandler } from "@/components/auth/OAuthDeepLinkHandler";
import { AppBootstrapGate } from "@/components/bootstrap/AppBootstrapGate";

/** Principal UI: menos “plantilla SaaS genérica”; encaja paleta terracotta PATT (ver globals.css). */
const pattSans = Plus_Jakarta_Sans({
  variable: "--font-patt",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PATT",
  description: "Tu compañero de descenso: rutas, actividad y ranking",
  manifest: "/manifest.json"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${pattSans.variable} min-h-[100dvh] bg-gdh-canvas font-sans text-slate-100 antialiased`}
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
