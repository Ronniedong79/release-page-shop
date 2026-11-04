import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { SESSION_COOKIE } from "@/server/http/auth";
import { getUserBySessionToken } from "@/server/services/authService";
import { LogoutButton } from "./LogoutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Release Shop",
  description: "Limited releases of collectible items",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = token ? getUserBySessionToken(token) : null;

  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">
            <strong>Release Shop</strong>
          </Link>
          {user ? (
            <span>
              {user.email} ({user.role}) <LogoutButton />
            </span>
          ) : (
            <Link href="/login">Log in</Link>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
