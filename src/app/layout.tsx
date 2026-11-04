import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/server/http/currentUser";
import { AdminNavLink } from "./AdminNavLink";
import { CartButton } from "./cart/CartButton";
import { CartProvider } from "./cart/CartContext";
import { SideCart } from "./cart/SideCart";
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

  const page = (
    <>
      <header>
        <nav>
          <Link href="/">
            <strong>Release Shop</strong>
          </Link>
          {user?.role === "admin" && <AdminNavLink />}
          {user?.role === "customer" && <Link href="/orders">My orders</Link>}
        </nav>
        {user ? (
          <span className="inline">
            {user.role === "customer" && <CartButton />}
            {user.email} ({user.role}) <LogoutButton />
          </span>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </header>
      <main>{children}</main>
    </>
  );

  return (
    <html lang="en">
      <body>
        {user?.role === "customer" ? (
          // key: a different customer logging in gets a fresh cart state
          <CartProvider key={user.id} userId={user.id}>
            {page}
            <SideCart />
          </CartProvider>
        ) : (
          page
        )}
      </body>
    </html>
  );
}
