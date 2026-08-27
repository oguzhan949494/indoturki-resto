// Basit admin şifre doğrulama yardımcı fonksiyonu.
// Şifreyi çerezde düz metin tutmamak için SHA-256 ile hashliyoruz.
// Web Crypto API (crypto.subtle) hem Edge Middleware'de hem Node route'larda çalışır.

export async function hashAdminPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const ADMIN_SESSION_COOKIE = "admin_session";
