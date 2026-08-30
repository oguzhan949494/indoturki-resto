"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { OPTION_LABELS } from "@/utils/menu-types";

type TableRow = {
  id: string;
  table_number: number;
};

type OrderItemDetail = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name_tr: string;
  quantity: number;
  unit_price_tl: number;
  item_note: string | null;
  options: string[] | null;
  split_group: number | null;
};

type ProductOption = {
  id: string;
  name_tr: string;
  price_tl: number;
  category_id: string;
};

type CategoryOption = {
  id: string;
  name_tr: string;
  emoji: string | null;
};

const SPLIT_GROUP_SAYISI = 6;

export default function MasaTakipPage() {
  const supabase = createClient();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [openSessionByTable, setOpenSessionByTable] = useState<Record<string, string>>({});
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionOpenedAt, setSessionOpenedAt] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItemDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [bolMod, setBolMod] = useState(false);

  const [urunEkleAcik, setUrunEkleAcik] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [aktifKategori, setAktifKategori] = useState<string | null>(null);
  const [eklenecekSepet, setEklenecekSepet] = useState<Record<string, number>>({});

  const tablesYukle = useCallback(async () => {
    const { data: tableRows } = await supabase
      .from("restaurant_tables")
      .select("id, table_number")
      .order("table_number", { ascending: true });

    setTables((tableRows as TableRow[]) ?? []);

    const { data: sessionRows } = await supabase
      .from("table_sessions")
      .select("id, table_id")
      .eq("status", "open");

    const map: Record<string, string> = {};
    for (const s of sessionRows ?? []) {
      map[(s as any).table_id] = (s as any).id;
    }
    setOpenSessionByTable(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    tablesYukle();
  }, [tablesYukle]);

  const masaDetayiYukle = useCallback(
    async (tableId: string, sessionId: string) => {
      const { data: sessionRow } = await supabase
        .from("table_sessions")
        .select("opened_at")
        .eq("id", sessionId)
        .single();
      setSessionOpenedAt((sessionRow as any)?.opened_at ?? null);

      const { data: orderRows } = await supabase
        .from("orders")
        .select("id, order_items(id, order_id, product_id, product_name_tr, quantity, unit_price_tl, item_note, options, split_group)")
        .eq("table_session_id", sessionId);

      const tumItems: OrderItemDetail[] = [];
      for (const order of orderRows ?? []) {
        for (const item of (order as any).order_items ?? []) {
          tumItems.push(item);
        }
      }
      setItems(tumItems);
    },
    [supabase]
  );

  const masaSec = async (table: TableRow) => {
    setSelectedTableId(table.id);
    setBolMod(false);
    const mevcutSession = openSessionByTable[table.id];
    if (mevcutSession) {
      setSelectedSessionId(mevcutSession);
      await masaDetayiYukle(table.id, mevcutSession);
    } else {
      setSelectedSessionId(null);
      setItems([]);
      setSessionOpenedAt(null);
    }
  };

  // Masada henüz açık oturum yoksa (personel ilk kez ürün ekliyorsa)
  // yeni bir oturum açar.
  const oturumGarantiEt = async (tableId: string): Promise<string> => {
    const mevcut = openSessionByTable[tableId];
    if (mevcut) return mevcut;

    const { data: yeniSession, error } = await supabase
      .from("table_sessions")
      .insert({ table_id: tableId, status: "open" })
      .select("id")
      .single();

    if (error || !yeniSession) throw new Error("Oturum açılamadı.");

    setOpenSessionByTable((prev) => ({ ...prev, [tableId]: yeniSession.id as string }));
    setSelectedSessionId(yeniSession.id as string);
    return yeniSession.id as string;
  };

  const miktarDegistir = async (item: OrderItemDetail, delta: number) => {
    const yeniMiktar = item.quantity + delta;
    if (yeniMiktar <= 0) {
      await supabase.from("order_items").delete().eq("id", item.id);
    } else {
      await supabase.from("order_items").update({ quantity: yeniMiktar }).eq("id", item.id);
    }
    if (selectedTableId && selectedSessionId) {
      await masaDetayiYukle(selectedTableId, selectedSessionId);
    }
  };

  const urunSil = async (item: OrderItemDetail) => {
    await supabase.from("order_items").delete().eq("id", item.id);
    if (selectedTableId && selectedSessionId) {
      await masaDetayiYukle(selectedTableId, selectedSessionId);
    }
  };

  const bolumAta = async (item: OrderItemDetail, grup: number | null) => {
    await supabase.from("order_items").update({ split_group: grup }).eq("id", item.id);
    if (selectedTableId && selectedSessionId) {
      await masaDetayiYukle(selectedTableId, selectedSessionId);
    }
  };

  const masayiSifirla = async (tableId: string) => {
    const sessionId = openSessionByTable[tableId];
    if (!sessionId) return;
    if (!window.confirm("Bu masayı sıfırlamak istediğinizden emin misiniz? Hesap kapatılmış sayılacak.")) {
      return;
    }
    await supabase
      .from("table_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", sessionId);

    setOpenSessionByTable((prev) => {
      const yeni = { ...prev };
      delete yeni[tableId];
      return yeni;
    });
    setSelectedSessionId(null);
    setItems([]);
    setSessionOpenedAt(null);
  };

  const urunEkleModalAc = async () => {
    if (!categories.length) {
      const { data: categoryRows } = await supabase
        .from("categories")
        .select("id, name_tr, emoji")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      const { data: productRows } = await supabase
        .from("products")
        .select("id, name_tr, price_tl, category_id")
        .eq("is_available", true)
        .order("sort_order", { ascending: true });

      setCategories((categoryRows as CategoryOption[]) ?? []);
      setProducts((productRows as ProductOption[]) ?? []);
      if (categoryRows && categoryRows.length > 0) {
        setAktifKategori((categoryRows[0] as any).id);
      }
    }
    setEklenecekSepet({});
    setUrunEkleAcik(true);
  };

  const sepeteEkle = (productId: string) => {
    setEklenecekSepet((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  };

  const sepettenAzalt = (productId: string) => {
    setEklenecekSepet((prev) => {
      const yeni = { ...prev };
      if (!yeni[productId]) return yeni;
      yeni[productId] -= 1;
      if (yeni[productId] <= 0) delete yeni[productId];
      return yeni;
    });
  };

  const siparisiKaydet = async () => {
    if (!selectedTableId) return;
    const secilenler = Object.entries(eklenecekSepet).filter(([, adet]) => adet > 0);
    if (secilenler.length === 0) return;

    const sessionId = await oturumGarantiEt(selectedTableId);

    const toplam = secilenler.reduce((sum, [productId, adet]) => {
      const urun = products.find((p) => p.id === productId);
      return sum + (urun ? Number(urun.price_tl) * adet : 0);
    }, 0);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        source: "table",
        table_id: selectedTableId,
        table_session_id: sessionId,
        customer_name: "Personel Eklemesi",
        total_tl: toplam,
        total_idr: 0,
        payment_status: "pending",
        order_status: "new",
      })
      .select("id")
      .single();

    if (orderError || !orderData) return;

    const orderItems = secilenler.map(([productId, adet]) => {
      const urun = products.find((p) => p.id === productId)!;
      return {
        order_id: orderData.id,
        product_id: urun.id,
        product_name_tr: urun.name_tr,
        quantity: adet,
        unit_price_tl: urun.price_tl,
        unit_price_idr: 0,
        options: [],
        item_note: null,
      };
    });

    await supabase.from("order_items").insert(orderItems);

    setUrunEkleAcik(false);
    await masaDetayiYukle(selectedTableId, sessionId);
  };

  const genelToplam = items.reduce((sum, i) => sum + i.unit_price_tl * i.quantity, 0);

  const bolumToplamlari = () => {
    const gruplar: Record<string, number> = { genel: 0 };
    for (let g = 1; g <= SPLIT_GROUP_SAYISI; g++) gruplar[String(g)] = 0;
    for (const item of items) {
      const anahtar = item.split_group ? String(item.split_group) : "genel";
      gruplar[anahtar] = (gruplar[anahtar] ?? 0) + item.unit_price_tl * item.quantity;
    }
    return gruplar;
  };

  const seciliMasa = tables.find((t) => t.id === selectedTableId);
  const kategoriUrunleri = products.filter((p) => p.category_id === aktifKategori);
  const eklenecekToplam = Object.entries(eklenecekSepet).reduce((sum, [productId, adet]) => {
    const urun = products.find((p) => p.id === productId);
    return sum + (urun ? Number(urun.price_tl) * adet : 0);
  }, 0);

  return (
    <main className="min-h-screen bg-[#f3f1ed] text-[#231710]">
      <header className="sticky top-0 z-20 border-b border-[#e2ddd3] bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Masa Takip</h1>
            <p className="text-xs text-[#7a6f63]">
              Bir masaya ait tüm siparişler, siz sıfırlayana kadar burada birikir.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
          >
            ← Panele Dön
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {loading ? (
          <p className="text-center font-bold text-[#7a6f63]">Yükleniyor...</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            {/* Masa listesi */}
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
              {tables.map((table) => {
                const acikMi = !!openSessionByTable[table.id];
                const seciliMi = selectedTableId === table.id;
                return (
                  <button
                    key={table.id}
                    onClick={() => masaSec(table)}
                    className={`rounded-2xl border p-4 text-center font-black transition ${
                      seciliMi
                        ? "border-[#231710] bg-[#231710] text-white"
                        : acikMi
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-[#e2ddd3] bg-white text-[#5b4032]"
                    }`}
                  >
                    <div className="text-lg">Masa {table.table_number}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wide">
                      {acikMi ? "🟠 Açık" : "⚪ Boş"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Masa detayı */}
            <div className="rounded-2xl border border-[#e2ddd3] bg-white p-5">
              {!seciliMasa ? (
                <p className="text-center text-sm font-bold text-[#7a6f63]">
                  Detayları görmek için bir masa seçin.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee7db] pb-4">
                    <div>
                      <h2 className="text-lg font-black">Masa {seciliMasa.table_number}</h2>
                      {sessionOpenedAt && (
                        <p className="text-xs text-[#7a6f63]">
                          Açılış: {new Date(sessionOpenedAt).toLocaleString("tr-TR")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={urunEkleModalAc}
                        className="rounded-full bg-[#231710] px-4 py-2 text-xs font-bold text-white"
                      >
                        + Ürün Ekle
                      </button>
                      {items.length > 0 && (
                        <button
                          onClick={() => setBolMod((v) => !v)}
                          className={`rounded-full px-4 py-2 text-xs font-bold ${
                            bolMod ? "bg-blue-600 text-white" : "border border-[#e2ddd3] text-[#5b4032]"
                          }`}
                        >
                          ✂️ Hesabı Böl
                        </button>
                      )}
                      {selectedSessionId && (
                        <button
                          onClick={() => masayiSifirla(seciliMasa.id)}
                          className="rounded-full border border-red-400 px-4 py-2 text-xs font-bold text-red-600"
                        >
                          🔄 Masayı Sıfırla
                        </button>
                      )}
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <p className="mt-6 text-center text-sm font-bold text-[#7a6f63]">
                      Bu masada henüz sipariş yok.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-[#eee7db] bg-[#fffaf4] p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold">{item.product_name_tr}</div>
                              <div className="text-xs text-[#7a6f63]">
                                {item.unit_price_tl.toLocaleString("tr-TR")} TL × {item.quantity}
                              </div>
                              {item.options && item.options.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {item.options.map((code) => (
                                    <span
                                      key={code}
                                      className="rounded-lg bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-800"
                                    >
                                      {OPTION_LABELS[code]?.tr ?? code}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.item_note && (
                                <div className="mt-1 text-[11px] italic text-amber-800">
                                  📝 {item.item_note}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                onClick={() => miktarDegistir(item, -1)}
                                className="h-8 w-8 rounded-full border border-[#e5d4c2] font-black"
                              >
                                −
                              </button>
                              <span className="w-5 text-center font-black">{item.quantity}</span>
                              <button
                                onClick={() => miktarDegistir(item, 1)}
                                className="h-8 w-8 rounded-full border border-[#e5d4c2] font-black"
                              >
                                +
                              </button>
                              <button
                                onClick={() => urunSil(item)}
                                className="ml-1 rounded-full border border-red-300 px-2 py-1 text-xs font-bold text-red-600"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {bolMod && (
                            <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[#eee7db] pt-2">
                              <span className="text-[11px] font-bold text-[#7a6f63]">Bölüm:</span>
                              <button
                                onClick={() => bolumAta(item, null)}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  !item.split_group
                                    ? "bg-[#231710] text-white"
                                    : "border border-[#e5d4c2] text-[#5b4032]"
                                }`}
                              >
                                Genel
                              </button>
                              {Array.from({ length: SPLIT_GROUP_SAYISI }, (_, i) => i + 1).map((g) => (
                                <button
                                  key={g}
                                  onClick={() => bolumAta(item, g)}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                    item.split_group === g
                                      ? "bg-blue-600 text-white"
                                      : "border border-[#e5d4c2] text-[#5b4032]"
                                  }`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {items.length > 0 && (
                    <div className="mt-5 border-t border-[#eee7db] pt-4">
                      <div className="flex items-center justify-between text-lg font-black">
                        <span>Genel Toplam</span>
                        <span>{genelToplam.toLocaleString("tr-TR")} TL</span>
                      </div>

                      {bolMod && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {Object.entries(bolumToplamlari())
                            .filter(([, tutar]) => tutar > 0)
                            .map(([grup, tutar]) => (
                              <div
                                key={grup}
                                className="flex items-center justify-between rounded-xl bg-[#f3f1ed] px-3 py-2 text-sm font-bold"
                              >
                                <span>{grup === "genel" ? "Genel (bölünmemiş)" : `Bölüm ${grup}`}</span>
                                <span>{tutar.toLocaleString("tr-TR")} TL</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Ürün ekleme modalı */}
      {urunEkleAcik && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black">Ürün Ekle</h3>
              <button
                onClick={() => setUrunEkleAcik(false)}
                className="rounded-full border border-[#e4d3c1] px-3 py-1.5 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setAktifKategori(c.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                    aktifKategori === c.id
                      ? "bg-[#ef2b1e] text-white"
                      : "border border-[#e5d4c2] text-[#5b4032]"
                  }`}
                >
                  {c.emoji} {c.name_tr}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {kategoriUrunleri.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-[#eee7db] px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-bold">{p.name_tr}</div>
                    <div className="text-xs text-[#7a6f63]">
                      {Number(p.price_tl).toLocaleString("tr-TR")} TL
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sepettenAzalt(p.id)}
                      className="h-8 w-8 rounded-full border border-[#e5d4c2] font-black"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-black">{eklenecekSepet[p.id] ?? 0}</span>
                    <button
                      onClick={() => sepeteEkle(p.id)}
                      className="h-8 w-8 rounded-full border border-[#e5d4c2] font-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={siparisiKaydet}
              disabled={eklenecekToplam === 0}
              className="mt-4 w-full rounded-2xl bg-[#231710] py-3 text-sm font-black text-white disabled:opacity-40"
            >
              Ekle ({eklenecekToplam.toLocaleString("tr-TR")} TL)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
