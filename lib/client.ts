// ikas Admin GraphQL API için sunucu taraflı yardımcı fonksiyonlar.
// Kaynak: https://ikas.dev/docs/api/getting-started/authentication
//
// Gerekli ortam değişkenleri (.env.local):
//   IKAS_STORE_NAME     -> mağaza alt alan adı (örn. "indomarket",
//                           https://indomarket.myikas.com/admin adresindeki kısım)
//   IKAS_CLIENT_ID
//   IKAS_CLIENT_SECRET

const GRAPHQL_ENDPOINT = "https://api.myikas.com/api/v1/admin/graphql";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getIkasAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const storeName = process.env.IKAS_STORE_NAME;
  const clientId = process.env.IKAS_CLIENT_ID;
  const clientSecret = process.env.IKAS_CLIENT_SECRET;

  if (!storeName || !clientId || !clientSecret) {
    throw new Error(
      "ikas ortam değişkenleri eksik: IKAS_STORE_NAME, IKAS_CLIENT_ID, IKAS_CLIENT_SECRET"
    );
  }

  const res = await fetch(`https://${storeName}.myikas.com/api/admin/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(`ikas token alınamadı: ${JSON.stringify(data)}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 14_400) * 1000,
  };

  return cachedToken.token;
}

export async function ikasGraphQL<T = any>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await getIkasAccessToken();

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors) {
    throw new Error(`ikas GraphQL hatası: ${JSON.stringify(json.errors)}`);
  }

  return json.data as T;
}
