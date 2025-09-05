import './globals.css'
import { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import Link from 'next/link'
import HeaderNav from '@/components/HeaderNav'

export const metadata = {
  title: 'share4print',
  description: 'Upload, preview, and share 3D printing models',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="border-b">
            <div className="container flex items-center justify-between py-3">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-8 w-8 rounded bg-brand"></span>
                share4print
              </Link>
              <HeaderNav />
            </div>
          </header>
          <main className="container py-6">{children}</main>
          <footer className="border-t mt-10">
            <div className="container py-6 text-sm text-gray-500">
              © {new Date().getFullYear()} share4print
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  )
}
