import type { Metadata } from "next"
import PDIThemeProvider from "@/lib/theme/provider"
import AppShell from "@/components/layout/AppShell"

export const metadata: Metadata = {
  title: "PDI Loyalty Billing",
  description: "Loyalty program billing and rules engine",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0 }}>
        <PDIThemeProvider>
          <AppShell>{children}</AppShell>
        </PDIThemeProvider>
      </body>
    </html>
  )
}
