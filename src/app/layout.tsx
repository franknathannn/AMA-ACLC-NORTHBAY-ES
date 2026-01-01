import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AMA ACLC Northbay | Enrollment System",
  description: "Official Enrollment Portal for AMA ACLC Northbay",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 1. Force className="light" and set color-scheme to light
    <html lang="en" className="light" style={{ colorScheme: 'light' }} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          // 2. Change "system" to "light"
          defaultTheme="light" 
          // 3. Disable system detection to prevent auto-switching
          enableSystem={false} 
          disableTransitionOnChange
        >
          <main className="min-h-screen">
            {children}
          </main>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}