"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header link for admins: goes to /admin, or back home when already there. */
export function AdminNavLink() {
  const onAdminPage = usePathname() === "/admin";
  return onAdminPage ? (
    <Link href="/">Save back to home</Link>
  ) : (
    <Link href="/admin">Edit Product</Link>
  );
}
