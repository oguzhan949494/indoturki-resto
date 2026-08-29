import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ============================================================
// İkas'tan "yeni sipariş oluştu" bildirimini yakalar, siparişin
// tam detayını ikas API'den çeker, Supabase'e yazar.
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

// Webhook payload'ının şekli garanti olmadığı için, olası tüm
// yerlerden sipariş id'sini bulmaya çalışıyoruz.
function siparisIdCikar(payload) {
  return (
    payload?.id ||
    payload?.orderId ||
    payload?.data?.id ||
    payload?.data?.orderId ||
    null
  );
}

async function siparisDetayiGetir(accessToken, orderId) {
  const query = `{
    listOrder(id: { eq: "${orderId}" }) {
      data {
        id
        orderNumber
        totalFinalPrice
        customer { firstName lastName fullName }
        orderLineItems {
          quantity
          finalPrice
          variant { name }
        }
      }
    }
  }`;

  const res = await fetch("https://api.myikas.com/api/v1/admin/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error("Sipariş detayı alınamadı: " + (await res.text()));
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));

  const siparis = json.data.listOrder.data[0];
  if (!siparis) throw new Error("Sipariş bulunamadı: " + orderId);
  return siparis;
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== process.env.SYNC_SECRET) {
    return Response.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const orderId = siparisIdCikar(payload);
    if (!orderId) {
      console.error("Webhook payload'ında sipariş id bulunamadı:", payload);
      return Response.json({ error: "orderId bulunamadı" }, { status: 400 });
    }

    const accessToken = await ikasAccessTokenAl();
    const siparis = await siparisDetayiGetir(accessToken, orderId);

    const urunler = (siparis.orderLineItems || []).map((satir) => ({
      ad: satir.variant?.name || "Ürün",
      adet: satir.quantity,
      fiyat: satir.finalPrice,
    }));

    const musteriAdi = siparis.customer?.fullName || siparis.customer?.firstName || "";

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabaseAdmin.from("ikas_siparisler").upsert(
      {
        ikas_order_id: siparis.id,
        siparis_no: siparis.orderNumber,
        musteri_adi: musteriAdi,
        urunler,
        toplam_tutar: siparis.totalFinalPrice,
        durum: "yeni",
      },
      { onConflict: "ikas_order_id" }
    );

    if (error) throw error;

    return Response.json({ mesaj: "Sipariş kaydedildi", siparis_no: siparis.orderNumber });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
