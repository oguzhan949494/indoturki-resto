import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ============================================================
// İkas'tan "yeni sipariş oluştu" webhook'unu yakalar.
// Önemli: ikas, sipariş verisinin tamamını "data" alanında
// JSON-STRING olarak gönderiyor (üst seviye "id" alanı sipariş
// id'si DEĞİL, webhook bildirim id'si). Bu yüzden ekstra bir
// API çağrısına gerek yok, data'yı parse etmek yeterli.
// ============================================================

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== process.env.SYNC_SECRET) {
    return Response.json({ error: "Yetkisiz" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    console.log("İKAS WEBHOOK PAYLOAD (ham):", JSON.stringify(payload));

    if (!payload.data) {
      return Response.json({ error: "payload.data alanı yok" }, { status: 400 });
    }

    const siparis = JSON.parse(payload.data);
    console.log("PARSE EDİLMİŞ SİPARİŞ:", JSON.stringify(siparis));

    const urunler = (siparis.orderLineItems || []).map((satir) => ({
      ad: satir.variant?.name || "Ürün",
      adet: satir.quantity,
      fiyat: satir.finalPrice ?? satir.price ?? 0,
    }));

    const musteriAdi =
      siparis.customer?.fullName ||
      [siparis.customer?.firstName, siparis.customer?.lastName].filter(Boolean).join(" ") ||
      siparis.personel?.firstName ||
      "";

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
        toplam_tutar: siparis.totalFinalPrice ?? siparis.totalPrice ?? 0,
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
