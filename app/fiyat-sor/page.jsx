"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

// Kendi tablo/kolon adlarına göre düzenle
const TABLE_NAME = "urunler";
const BARKOD_KOLON = "barkod";
const AD_KOLON = "urun_adi";
const FIYAT_KOLON = "fiyat";

export default function FiyatSorPage() {
  const readerRef = useRef(null);
  const scannerRef = useRef(null);
  const [sonuc, setSonuc] = useState(null); // { ad, fiyat } | "hata" | "bekleniyor" | null
  const [manuelBarkod, setManuelBarkod] = useState("");
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

  // Bazı barkod okuyucular EAN-13'ü UPC-A gibi algılayıp baştaki
  // rakamı (genelde 0, bazen başka bir rakam) düşürebiliyor.
  // Bu yüzden okunan koda 0-9 arası her rakamı ekleyerek de
  // aynı anda soruyoruz — hangisi tabloda varsa o eşleşir.
  function adayBarkodlariUret(okunanKod) {
    const adaylar = [okunanKod];
    for (let rakam = 0; rakam <= 9; rakam++) {
      adaylar.push(String(rakam) + okunanKod);
    }
    return adaylar;
  }

  async function fiyatSorgula(barkod) {
    if (!barkod) return;
    setSonuc("bekleniyor");

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
          </>
        )}
      </div>
    </div>
  );
}
