// ============================================================
// TEK SEFERLİK KURULUM: İkas'a "yeni sipariş oluştu" webhook'unu
// kaydeder. Bir kere ziyaret edip çalıştıktan sonra bu dosyayı
// silebilirsin (ya da öylece dursun, tekrar çağırmak zararsız,
// sadece webhook'u günceller).
//
// Kullanım: https://siten.com/api/ikas-webhook-setup?secret=SYNC_SECRET
//
// Aynı ortam değişkenlerini kullanır: IKAS_STORE_NAME, IKAS_CLIENT_ID,
// IKAS_CLIENT_SECRET, SYNC_SECRET (ikas-sync route'uyla aynı)
// ============================================================

async function ikasAccessTokenAl() {
  const url = `https://${process.env.IKAS_STORE_NAME}.myikas.com/api/admin/oauth/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.IKAS_CLIENT_ID,
      client_secret: process.env.IKAS_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error("İkas token alınamadı: " + (await res.text()));
  const data = await res.json();
  return data.access_token;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== process.env.SYNC_SECRET) {
    return Response.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const accessToken = await ikasAccessTokenAl();

    // Webhook'un gideceği adres: bu sitenin sipariş yakalayıcı endpoint'i
    const webhookEndpoint = `https://${request.headers.get("host")}/api/ikas-order-webhook?secret=${process.env.SYNC_SECRET}`;

    const mutation = `mutation {
      saveWebhook(input: {
        scopes: ["store/order/created"]
        endpoint: "${webhookEndpoint}"
      }) {
        id
        scope
        endpoint
      }
    }`;

    const res = await fetch("https://api.myikas.com/api/v1/admin/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: mutation }),
    });

    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));

    return Response.json({
      mesaj: "Webhook kaydedildi. Artık yeni siparişler otomatik yakalanacak.",
      detay: json.data.saveWebhook,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
