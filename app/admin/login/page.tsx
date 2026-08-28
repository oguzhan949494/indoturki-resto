"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/admin";
  const missingPassword = searchParams.get("missing") === "1";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Giriş başarısız.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f1ed] p-4 text-[#231710]">
      <div className="w-full max-w-sm rounded-3xl border border-[#e2ddd3] bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-3xl">🔒</div>
          <h1 className="mt-2 text-lg font-black">Indoturki Resto — Yönetici Girişi</h1>
          <p className="mt-1 text-xs text-[#7a6f63]">Devam etmek için admin şifresini girin.</p>
        </div>

        {missingPassword && (
          <div className="mb-4 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
            Sunucuda admin şifresi tanımlı değil. Lütfen .env.local dosyasına ADMIN_PASSWORD
            ekleyin.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Admin şifresi"
            className="w-full rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e] focus:ring-2 focus:ring-[#ef2b1e]/10"
          />

          {error && <p className="text-xs font-bold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[#ef2b1e] px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-[#d92318] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Kontrol ediliyor..." : "Giriş Yap"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
