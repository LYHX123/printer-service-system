import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { LanguageProvider } from "@/lib/i18n/LanguageContext"
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister"
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
