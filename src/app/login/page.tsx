"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Login failed.");
      return;
    }
    router.push("/");
    router.refresh(); // re-render server components (header) with the new session cookie
  }

  return (
    <>
      <h1>Log in</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <br />
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Password
          <br />
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </>
  );
}
