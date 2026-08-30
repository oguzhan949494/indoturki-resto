"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();
const YENILEME_SANIYE = 5;
const ISLETME_ADI = "INDOTURKI RESTO";
const SITE_ADRESI = "www.indoturkimarket.com";

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

// Tek bir fiş içeriği — hem tekli hem toplu yazdırmada kullanılıyor
function FisIcerigi({ siparis }: { siparis: Siparis }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#000", fontSize: 11, lineHeight: 1.4 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{ISLETME_ADI}</div>
      </div>
      <p style={{ margin: 0 }}>Sipariş No: {siparis.siparis_no}</p>
      <p style={{ margin: 0 }}>Müşteri: {siparis.musteri_adi || "—"}</p>
      <p style={{ margin: "0 0 8px" }}>
        Tarih: {new Date(siparis.olusturuldu).toLocaleString("tr-TR")}
      </p>
      <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "4px 0" }}>
        {siparis.urunler.map((u, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span>
              {u.adet}x {u.ad}
            </span>
            <span>{Number(u.fiyat).toFixed(2)} ₺</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 6, fontSize: 12 }}>
        <span>Toplam</span>
        <span>{Number(siparis.toplam_tutar).toFixed(2)} ₺</span>
      </div>
      <div style={{ textAlign: "center", marginTop: 10, fontSize: 9, color: "#333" }}>{SITE_ADRESI}</div>
    </div>
  );
}

export default function SiparisPanelPage() {
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [yazdirilacak, setYazdirilacak] = useState<Siparis | null>(null);
  const [tumunuYazdir, setTumunuYazdir] = useState<Siparis[] | null>(null);
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

  async function tumunuYazdirVeIsaretle() {
    if (siparisler.length === 0) return;
    const hepsi = siparisler;
    setTumunuYazdir(hepsi);
    setTimeout(async () => {
      window.print();
      const idler = hepsi.map((s) => s.id);
      await supabase.from("ikas_siparisler").update({ durum: "yazdirildi" }).in("id", idler);
      setTumunuYazdir(null);
      siparisleriGetir();
    }, 150);
  }

  async function siparisiSil(siparis: Siparis) {
    if (!window.confirm(`Sipariş #${siparis.siparis_no} silinsin mi? Bu işlem geri alınamaz.`)) return;
    await supabase.from("ikas_siparisler").delete().eq("id", siparis.id);
    siparisleriGetir();
  }

  // Yazdırma sırasında 2'şerli gruplara böl (A4 dikey sayfa, kesim için 2 fiş yan yana)
  function sayfalaraBol(liste: Siparis[]): Siparis[][] {
    const sayfalar: Siparis[][] = [];
    for (let i = 0; i < liste.length; i += 2) {
      sayfalar.push(liste.slice(i, i + 3));
    }
    return sayfalar;
  }

  return (
    <>
      {/*
        DÜZELTME: Önceki sürüm "visibility: hidden" kullanıyordu — bu,
        elemanları görünmez yapar ama sayfadaki YERLERİNİ boş bırakmaz.
        Bu da fişin "position: absolute" ile konumlandırılmasını tarayıcıya
        göre değişken/güvenilmez hale getiriyordu (ortada basma sorunu
        buradan kaynaklanıyordu). Şimdi ekran içeriğini yazdırırken
        TAMAMEN kaldırıyoruz (display:none) ve fiş içeriğini normal sayfa
        akışında gösteriyoruz — böylece otomatik olarak sayfanın en
        üstünden başlıyor, mutlak konumlandırmaya hiç gerek kalmıyor.
      */}
      <div
        className="ekran-icerigi"
        style={{ minHeight: "100vh", background: "#0f1115", color: "#f2f2f2", padding: 20, fontFamily: "-apple-system, Segoe UI, Roboto, Arial, sans-serif" }}
      >
        <style>{`
          @media print {
            .ekran-icerigi { display: none !important; }
          }
        `}</style>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.3rem", margin: 0 }}>📋 Yeni Siparişler ({siparisler.length})</h1>
          <button
            onClick={tumunuYazdirVeIsaretle}
            disabled={siparisler.length === 0}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: siparisler.length === 0 ? "#2a2d36" : "#22c55e",
              color: siparisler.length === 0 ? "#6b7280" : "#fff",
              fontWeight: 600,
              cursor: siparisler.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            🖨️ Tümünü Yazdır ({siparisler.length})
          </button>
        </div>

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
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => yazdirVeIsaretle(s)}
                    style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#3a7bfd", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                  >
                    🖨️ Yazdır
                  </button>
                  <button
                    onClick={() => siparisiSil(s)}
                    style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ff6b6b", background: "transparent", color: "#ff6b6b", fontWeight: 600, cursor: "pointer" }}
                  >
                    🗑️ Sil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tekli yazdırma alanı — ekranda hiç görünmez, sadece yazdırmada belirir */}
      {yazdirilacak && (
        <div id="yazdirma-tekli" style={{ display: "none" }}>
          <style>{`
            @media print {
              #yazdirma-tekli {
                display: block !important;
                width: 50%;
              }
              @page { size: A4 portrait; margin: 8mm; }
            }
          `}</style>
          <FisIcerigi siparis={yazdirilacak} />
        </div>
      )}

      {/* Toplu yazdırma alanı — 2'şerli sayfalara bölünmüş, A4 dikey yan yana (kesim için) */}
      {tumunuYazdir && (
        <div id="yazdirma-tumu" style={{ display: "none" }}>
          <style>{`
            @media print {
              #yazdirma-tumu {
                display: block !important;
                width: 100%;
              }
              @page { size: A4 portrait; margin: 8mm; }
              .fis-sayfasi { display: flex; page-break-after: always; }
              .fis-sayfasi:last-child { page-break-after: auto; }
              .fis-sutun { flex: 1; padding: 0 4mm; border-right: 1px dashed #999; }
              .fis-sutun:last-child { border-right: none; }
            }
          `}</style>
          {sayfalaraBol(tumunuYazdir).map((sayfa, i) => (
            <div key={i} className="fis-sayfasi">
              {sayfa.map((s) => (
                <div key={s.id} className="fis-sutun">
                  <FisIcerigi siparis={s} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
