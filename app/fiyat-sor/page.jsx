// @ts-nocheck
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

// Kendi tablo/kolon adlarına göre düzenle
const TABLE_NAME = "urunler";
const BARKOD_KOLON = "barkod";
const AD_KOLON = "urun_adi";
const FIYAT_KOLON = "fiyat";

function FiyatSorInner() {
  const searchParams = useSearchParams();
  const masaNo = searchParams.get("masa");

  const readerRef = useRef(null);
  const scannerRef = useRef(null);
  const [sonuc, setSonuc] = useState(null); // { ad, fiyat } | "hata" | "bekleniyor" | null
  const [manuelBarkod, setManuelBarkod] = useState("");
  const [sepetUrun, setSepetUrun] = useState(null); // { id, ad, fiyat } | null
  const [sepeteEklendi, setSepeteEklendi] = useState(false);
  const lastCodeRef = useRef({ code: "", time: 0 });

  useEffect(() => {
    let html5QrCode;

    import("html5-qrcode").then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 260, height: 160 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
        ],
      };

      html5QrCode
        .start({ facingMode: "environment" }, config, onScanSuccess)
        .catch(() => setSonuc("kamera-hata"));
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScanSuccess(decodedText) {
    const now = Date.now();
    if (
      decodedText === lastCodeRef.current.code &&
      now - lastCodeRef.current.time < 3000
    ) {
      return;
    }
    lastCodeRef.current = { code: decodedText, time: now };
    fiyatSorgula(decodedText);
  }

  // Barkod okuyucu ile sistemdeki kayıt arasında baştaki
  // rakam sayısı tutmayabiliyor (fazladan eklenmiş ya da
  // eksik olabiliyor) — bu yüzden hem baştan bir rakam
  // ekleyerek hem de baştan bir rakam çıkararak olası tüm
  // varyasyonları aynı anda deniyoruz.
  function adayBarkodlariUret(okunanKod) {
    const adaylar = [okunanKod];

    // Baştan bir rakam eksik olabilir ihtimaline karşı (0-9 ekle)
    for (let rakam = 0; rakam <= 9; rakam++) {
      adaylar.push(String(rakam) + okunanKod);
    }

    // Baştan fazladan bir rakam gelmiş olabilir ihtimaline karşı (ilk rakamı çıkar)
    if (okunanKod.length > 1) {
      adaylar.push(okunanKod.slice(1));
    }

    return adaylar;
  }

  async function fiyatSorgula(barkod) {
    if (!barkod) return;
    setSonuc("bekleniyor");
    setSepetUrun(null);
    setSepeteEklendi(false);

    const adaylar = adayBarkodlariUret(barkod.trim());

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`${AD_KOLON}, ${FIYAT_KOLON}`)
      .in(BARKOD_KOLON, adaylar)
      .limit(1);

    if (error || !data || data.length === 0) {
      setSonuc("hata");
      return;
    }

    setSonuc({ ad: data[0][AD_KOLON], fiyat: data[0][FIYAT_KOLON] });

    // Masadan sepete ekleyebilmek için, aynı barkodla eşleşen bizim
    // market ürünümüzü (ikas'tan senkronize edilen) de ara.
    if (masaNo) {
      const { data: urunData } = await supabase
        .from("products")
        .select("id, name_tr, price_tl")
        .eq("section", "market")
        .in("barcode", adaylar)
        .limit(1)
        .maybeSingle();

      if (urunData) {
        setSepetUrun({ id: urunData.id, ad: urunData.name_tr, fiyat: urunData.price_tl });
      }
    }
  }

  // Barkodla bulunan ürünü, doğrudan masanın açık oturumuna ekler
  // (kendi mini siparişi olarak — kasiyer "Masa Takip"te görür).
  async function sepeteEkle() {
    if (!sepetUrun || !masaNo) return;

    const { data: tableRow } = await supabase
      .from("restaurant_tables")
      .select("id")
      .eq("table_number", Number(masaNo))
      .maybeSingle();
    if (!tableRow) return;

    let sessionId;
    const { data: existingSession } = await supabase
      .from("table_sessions")
      .select("id")
      .eq("table_id", tableRow.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSession?.id) {
      sessionId = existingSession.id;
    } else {
      const { data: newSession } = await supabase
        .from("table_sessions")
        .insert({ table_id: tableRow.id, status: "open" })
        .select("id")
        .single();
      sessionId = newSession?.id;
    }
    if (!sessionId) return;

    const { data: orderData } = await supabase
      .from("orders")
      .insert({
        source: "table",
        table_id: tableRow.id,
        table_session_id: sessionId,
        customer_name: "Barkod ile eklendi",
        total_tl: sepetUrun.fiyat,
        total_idr: 0,
        payment_status: "pending",
        order_status: "new",
      })
      .select("id")
      .single();
    if (!orderData) return;

    await supabase.from("order_items").insert({
      order_id: orderData.id,
      product_id: sepetUrun.id,
      product_name_tr: sepetUrun.ad,
      quantity: 1,
      unit_price_tl: sepetUrun.fiyat,
      unit_price_idr: 0,
      options: [],
      item_note: null,
    });

    setSepeteEklendi(true);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1115",
        color: "#f2f2f2",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 16,
        fontFamily: "-apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      {masaNo && (
        <div style={{ width: "100%", maxWidth: 460, marginBottom: 8 }}>
          <Link
            href={`/menu?masa=${masaNo}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #2a2d36",
              background: "#1a1d24",
              color: "#f2f2f2",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "0.95rem",
            }}
          >
            ← Masaya Dön
          </Link>
        </div>
      )}

      <h1 style={{ fontSize: "1.2rem", margin: "8px 0 16px", textAlign: "center" }}>
        📷 Ürünün barkodunu kameraya gösterin
      </h1>

      <div
        id="reader"
        ref={readerRef}
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 14,
          overflow: "hidden",
          border: "2px solid #2a2d36",
        }}
      />

      <div style={{ width: "100%", maxWidth: 460, marginTop: 12, display: "flex", gap: 8 }}>
        <input
          value={manuelBarkod}
          onChange={(e) => setManuelBarkod(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fiyatSorgula(manuelBarkod.trim())}
          type="text"
          inputMode="numeric"
          placeholder="Barkodu elle girin (opsiyonel)"
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #2a2d36",
            background: "#1a1d24",
            color: "#fff",
            fontSize: "1rem",
          }}
        />
        <button
          onClick={() => fiyatSorgula(manuelBarkod.trim())}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: "#3a7bfd",
            color: "#fff",
            fontWeight: 600,
            fontSize: "1rem",
          }}
        >
          Sorgula
        </button>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 460,
          marginTop: 18,
          minHeight: 90,
          borderRadius: 14,
          background: "#1a1d24",
          padding: 18,
          textAlign: "center",
        }}
      >
        {sonuc === null && <div style={{ color: "#6b7280" }}>Barkod bekleniyor…</div>}
        {sonuc === "bekleniyor" && <div style={{ color: "#6b7280" }}>Fiyat aranıyor…</div>}
        {sonuc === "hata" && (
          <div style={{ color: "#ff6b6b" }}>Bu barkoda ait ürün bulunamadı.</div>
        )}
        {sonuc === "kamera-hata" && (
          <div style={{ color: "#ff6b6b" }}>
            Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin.
          </div>
        )}
        {sonuc && typeof sonuc === "object" && (
          <>
            <div style={{ fontSize: "1.05rem", color: "#b9bcc4", marginBottom: 6 }}>
              {sonuc.ad}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700 }}>
              {Number(sonuc.fiyat).toLocaleString("tr-TR", {
                minimumFractionDigits: 2,
              })}{" "}
              ₺
            </div>

            {sepetUrun && !sepeteEklendi && (
              <button
                onClick={sepeteEkle}
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: 14,
                  borderRadius: 12,
                  border: "none",
                  background: "#22c55e",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "1rem",
                }}
              >
                🛒 Sepete Ekle
              </button>
            )}

            {sepeteEklendi && (
              <div style={{ marginTop: 14, color: "#22c55e", fontWeight: 700 }}>
                ✅ Sepete eklendi — Masa {masaNo} hesabına yansıdı
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FiyatSorPage() {
  return (
    <Suspense fallback={null}>
      <FiyatSorInner />
    </Suspense>
  );
}
