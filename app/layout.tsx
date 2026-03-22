import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MIDILLA — Content Production System',
  description: 'Expert-grade content. Delivered.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
