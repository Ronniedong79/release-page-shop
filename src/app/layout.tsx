import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Release Shop",
  description: "Limited releases of collectible items",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header>
          <strong>Release Shop</strong>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
