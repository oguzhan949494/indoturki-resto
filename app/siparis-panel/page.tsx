"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();
const YENILEME_SANIYE = 5;

interface UrunSatiri {
  ad: string;
  adet: number;
  fiyat: number;
}

interface Siparis {
  id: number;
  ikas_order_id: string;
  siparis_no: string;
  musteri_adi: string;
  urunler: UrunSatiri[];
  toplam_tutar: number;
  durum: string;
  olusturuldu: string;
}

export default function SiparisPanelPage() {
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [yazdirilacak, setYazdirilacak] = useState<Siparis | null>(null);
  const bilinenIdlerRef = useRef<Set<number>>(new Set());

  const siparisleriGetir = useCallback(async () => {
    const { data, error } = await supabase
      .from("ikas_siparisler")
      .select("*")
      .eq("durum", "yeni")
      .order("olusturuldu", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const gelenler = (data || []) as Siparis[];
    const yeniIdler = new Set(gelenler.map((s) => s.id));
    const oncekiBosMuydu = bilinenIdlerRef.current.size === 0;
    const yeniVarMi = gelenler.some((s) => !bilinenIdlerRef.current.has(s.id));

    if (yeniVarMi && !(oncekiBosMuydu && gelenler.length === 0)) {
      sesliUyariVer();
    }

    bilinenIdlerRef.current = yeniIdler;
    setSiparisler(gelenler);
  }, []);

  useEffect(() => {
    siparisleriGetir();
    const interval = setInterval(siparisleriGetir, YENILEME_SANIYE * 1000);
    return () => clearInterval(interval);
  }, [siparisleriGetir]);

  function sesliUyariVer() {
    try {
      const AudioContextSinifi =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextSinifi();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      /* sessizce geç */
    }
  }

  async function yazdirVeIsaretle(siparis: Siparis) {
    setYazdirilacak(siparis);
    setTimeout(async () => {
      window.print();
      await supabase.from("ikas_siparisler").update({ durum: "yazdirildi" }).eq("id", siparis.id);
      setYazdirilacak(null);
      siparisleriGetir();
    }, 150);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1115", color: "#f2f2f2", padding: 20, fontFamily: "-apple-system, Segoe UI, Roboto, Arial, sans-serif" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #yazdirma-alani, #yazdirma-alani * { visibility: visible; }
          #yazdirma-alani { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4; margin: 20mm; }
        }
      `}</style>

      <h1 style={{ fontSize: "1.3rem", marginBottom: 20 }}>📋 Yeni Siparişler ({siparisler.length})</h1>

      {siparisler.length === 0 && (
        <div style={{ color: "#6b7280" }}>Bekleyen sipariş yok. Otomatik yenileniyor…</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {siparisler.map((s) => (
          <div key={s.id} style={{ background: "#1a1d24", border: "1px solid #2a2d36", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <strong>Sipariş #{s.siparis_no}</strong>
              <span style={{ color: "#9aa0ab" }}>{s.musteri_adi}</span>
            </div>
            <ul style={{ margin: "8px 0", paddingLeft: 18, color: "#c8cbd2" }}>
              {s.urunler.map((u, i) => (
                <li key={i}>
                  {u.adet}x {u.ad} — {Number(u.fiyat).toFixed(2)} ₺
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <strong>Toplam: {Number(s.toplam_tutar).toFixed(2)} ₺</strong>
              <button
                onClick={() => yazdirVeIsaretle(s)}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#3a7bfd", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                🖨️ Yazdır
              </button>
            </div>
          </div>
        ))}
      </div>

      {yazdirilacak && (
        <div id="yazdirma-alani" style={{ display: "none" }}>
          <style>{`@media print { #yazdirma-alani { display: block !important; } }`}</style>
          <div style={{ fontFamily: "Arial, sans-serif", color: "#000" }}>
            <h2 style={{ marginBottom: 4 }}>Warkop Tantuni</h2>
            <p style={{ margin: 0 }}>Sipariş No: {yazdirilacak.siparis_no}</p>
            <p style={{ margin: 0 }}>Müşteri: {yazdirilacak.musteri_adi || "—"}</p>
            <p style={{ margin: "0 0 16px" }}>Tarih: {new Date(yazdirilacak.olusturuldu).toLocaleString("tr-TR")}</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <th style={{ textAlign: "left", padding: 4 }}>Ürün</th>
                  <th style={{ textAlign: "center", padding: 4 }}>Adet</th>
                  <th style={{ textAlign: "right", padding: 4 }}>Fiyat</th>
                </tr>
              </thead>
              <tbody>
                {yazdirilacak.urunler.map((u, i) => (
                  <tr key={i}>
                    <td style={{ padding: 4 }}>{u.ad}</td>
                    <td style={{ textAlign: "center", padding: 4 }}>{u.adet}</td>
                    <td style={{ textAlign: "right", padding: 4 }}>{Number(u.fiyat).toFixed(2)} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ textAlign: "right", marginTop: 16 }}>
              Toplam: {Number(yazdirilacak.toplam_tutar).toFixed(2)} ₺
            </h3>
          </div>
        </div>
      )}
    </div>
  );
}
