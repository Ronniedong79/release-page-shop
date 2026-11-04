import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/server/http/currentUser";
import { AdminNavLink } from "./AdminNavLink";
import { LogoutButton } from "./LogoutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Release Shop",
  description: "Limited releases of collectible items",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            <Link href="/">
              <strong>Release Shop</strong>
            </Link>
            {user?.role === "admin" && <AdminNavLink />}
            {user?.role === "customer" && <Link href="/orders">My orders</Link>}
          </nav>
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
