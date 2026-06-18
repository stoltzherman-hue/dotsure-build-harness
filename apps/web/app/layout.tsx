import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/layout/Sidebar"
import { Concierge } from "@/components/Concierge"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Dotsure Build Harness",
  description: "Enterprise AI governance platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="app">
          <Sidebar />
          <div className="main">{children}</div>
        </div>
        <Concierge />
      </body>
    </html>
  )
}