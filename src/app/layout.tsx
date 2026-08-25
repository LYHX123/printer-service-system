import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { LanguageProvider } from "@/lib/i18n/LanguageContext"
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister"
import { AppModeProvider } from "@/components/platform/AppModeProvider"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Printer Service System",
  description: "Printer repair and service management",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Office Hub",
  },
  other: {
    // Legacy iOS tag — older Safari versions don't honor `mobile-web-app-capable`.
    "apple-mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f3d2e",
  viewportFit: "cover",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const isAppMode = await isCapacitorAppRequest()

  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
      data-app-mode={isAppMode ? "true" : undefined}
      // Capacitor 8's built-in SystemBars plugin (bundled in @capacitor/core,
      // default `insetsHandling: "css"`) injects --safe-area-inset-* custom
      // properties onto this exact element natively, as a documented
      // workaround for a real Chromium WebView bug where env(safe-area-inset-*)
      // misreports on WebView < 140 (https://issues.chromium.org/issues/40699457).
      // That injection happens outside React/SSR entirely — the server can
      // never know a specific device's real inset pixel values — so this is
      // the canonical "third-party script modifies the DOM before React"
      // case suppressHydrationWarning exists for. Scoped to this one node
      // only; every other attribute here still hydrates strictly.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <AppModeProvider isAppMode={isAppMode}>
          <LanguageProvider>{children}</LanguageProvider>
        </AppModeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
