import Link from "next/link";
import { getCurrentUser } from "@/server/http/currentUser";
import { listAllProducts } from "@/server/services/productService";
import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";

// Convenience UI only. The real protection is in the API: every admin endpoint
// checks the role itself, so hiding this page is not what keeps customers out.
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return (
      <>
        <h1>Admin</h1>
        <p className="error">Admins only.</p>
        {!user && <Link href="/login">Log in as an admin</Link>}
      </>
    );
  }

  return (
    <>
      <h1>Admin</h1>
      <AdminPanel products={listAllProducts()} />
    </>
  );
}
