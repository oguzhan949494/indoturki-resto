"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type PosCartLine = {
  key: string;
  productId: string | null;
  name: string;
  price: number;
  quantity: number;
  isMarket: boolean;
  fromTableOrderItemId: string | null;
  fromTableId: string | null;
};

type CategoryOption = { id: string; name_tr: string; emoji: string | null };
type ProductOption = {
  id: string;
  name_tr: string;
  price_tl: number;
  category_id: string;
  section: string;
  barcode: string | null;
};

type TableOption = { id: string; table_number: number; sessionId: string };
type TableItem = {
  id: string;
  product_id: string | null;
  product_name_tr: string;
  quantity: number;
  unit_price_tl: number;
  split_group: number | null;
  isMarket: boolean;
};

type BankInfo = {
  tlAccountName: string;
  tlIban: string;
  idrBank: string;
  idrAccountName: string;
  idrAccountNumber: string;
};

let keySayaci = 0;
const yeniKey = () => `pos-${Date.now()}-${keySayaci++}`;

export default function RestoPosPage() {
  const supabase = createClient();

  const [posCart, setPosCart] = useState<PosCartLine[]>([]);
  const [barkodDeger, setBarkodDeger] = useState("");
  const barkodRef = useRef<HTMLInputElement>(null);

  const [fiyatGorModu, setFiyatGorModu] = useState(false);
  const [fiyatGorSonuc, setFiyatGorSonuc] = useState<
    { ad: string; fiyat: number } | "bulunamadi" | null
  >(null);

  const [tarananHata, setTarananHata] = useState<string | null>(null);

  const [menuModalAcik, setMenuModalAcik] = useState(false);
  const [tablesModalAcik, setTablesModalAcik] = useState(false);
  const [manuelModalAcik, setManuelModalAcik] = useState(false);
  const [odemeModalAcik, setOdemeModalAcik] = useState(false);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [aktifKategori, setAktifKategori] = useState<string | null>(null);
  const [menuArama, setMenuArama] = useState("");

  const [tablesList, setTablesList] = useState<TableOption[]>([]);
  const [seciliTable, setSeciliTable] = useState<TableOption | null>(null);
  const [tableItems, setTableItems] = useState<TableItem[]>([]);
  const [cagriMiktarlari, setCagriMiktarlari] = useState<Record<string, number>>({});

  const [manuelAd, setManuelAd] = useState("");
  const [manuelFiyat, setManuelFiyat] = useState("");

  const [indirimKapsam, setIndirimKapsam] = useState<"none" | "general" | "market">("none");
  const [indirimTip, setIndirimTip] = useState<"percent" | "fixed">("percent");
  const [indirimDeger, setIndirimDeger] = useState("");

  const [odemeYontemi, setOdemeYontemi] = useState<"nakit" | "kart" | "havale" | null>(null);
  const [alinanPara, setAlinanPara] = useState("");
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const [otomatikYazdir, setOtomatikYazdir] = useState(false);
  const [yazdiriliyor, setYazdiriliyor] = useState(false);

  useEffect(() => {
    const kayitli = localStorage.getItem("pos-otomatik-yazdir");
    setOtomatikYazdir(kayitli === "1");
  }, []);

  const otomatikYazdirDegistir = (deger: boolean) => {
    setOtomatikYazdir(deger);
    localStorage.setItem("pos-otomatik-yazdir", deger ? "1" : "0");
  };

  // Barkod okuyucu klavye gibi davranır — bu alanı hep odakta tutuyoruz.
  useEffect(() => {
    const odaklan = () => {
      if (
        !menuModalAcik &&
        !tablesModalAcik &&
        !manuelModalAcik &&
        !odemeModalAcik &&
        barkodRef.current
      ) {
        barkodRef.current.focus();
      }
    };
    odaklan();
    document.addEventListener("click", odaklan);
    return () => document.removeEventListener("click", odaklan);
  }, [menuModalAcik, tablesModalAcik, manuelModalAcik, odemeModalAcik]);

  const barkodIsle = useCallback(
    async (kod: string) => {
      const temiz = kod.trim();
      if (!temiz) return;

      const { data } = await supabase
        .from("products")
        .select("id, name_tr, price_tl, section")
        .eq("barcode", temiz)
        .limit(1)
        .maybeSingle();

      if (!data) {
        if (fiyatGorModu) {
          setFiyatGorSonuc("bulunamadi");
        } else {
          setTarananHata(`Barkod bulunamadı: ${temiz}`);
          setTimeout(() => setTarananHata(null), 3000);
        }
        return;
      }

      if (fiyatGorModu) {
        setFiyatGorSonuc({ ad: data.name_tr, fiyat: Number(data.price_tl) });
        return;
      }

      setPosCart((current) => {
        const mevcut = current.find((l) => l.productId === data.id && !l.fromTableOrderItemId);
        if (mevcut) {
          return current.map((l) =>
            l.key === mevcut.key ? { ...l, quantity: l.quantity + 1 } : l
          );
        }
        return [
          ...current,
          {
            key: yeniKey(),
            productId: data.id,
            name: data.name_tr,
            price: Number(data.price_tl),
            quantity: 1,
            isMarket: data.section === "market",
            fromTableOrderItemId: null,
            fromTableId: null,
          },
        ];
      });
    },
    [fiyatGorModu, supabase]
  );

  const barkodEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      barkodIsle(barkodDeger);
      setBarkodDeger("");
    }
  };

  // ---------- Menü modalı ----------
  const menuModalAc = async () => {
    if (!categories.length) {
      const { data: categoryRows } = await supabase
        .from("categories")
        .select("id, name_tr, emoji")
        .eq("is_active", true)
        .eq("section", "menu")
        .order("sort_order");
      const { data: productRows } = await supabase
        .from("products")
        .select("id, name_tr, price_tl, category_id, section, barcode")
        .order("sort_order");

      setCategories((categoryRows as CategoryOption[]) ?? []);
      setProducts((productRows as ProductOption[]) ?? []);
      if (categoryRows && categoryRows.length > 0) {
        setAktifKategori((categoryRows[0] as any).id);
      }
    }
    setMenuArama("");
    setMenuModalAcik(true);
  };

  const menuUrunEkle = (p: ProductOption) => {
    setPosCart((current) => {
      const mevcut = current.find((l) => l.productId === p.id && !l.fromTableOrderItemId);
      if (mevcut) {
        return current.map((l) =>
          l.key === mevcut.key ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...current,
        {
          key: yeniKey(),
          productId: p.id,
          name: p.name_tr,
          price: Number(p.price_tl),
          quantity: 1,
          isMarket: p.section === "market",
          fromTableOrderItemId: null,
          fromTableId: null,
        },
      ];
    });
  };

  const menuGosterilenUrunler = menuArama.trim()
    ? products.filter((p) =>
        p.name_tr.toLocaleLowerCase("tr-TR").includes(menuArama.trim().toLocaleLowerCase("tr-TR"))
      )
    : products.filter((p) => p.category_id === aktifKategori);

  // ---------- Masalar modalı ----------
  const tablesModalAc = async () => {
    const { data: sessionRows } = await supabase
      .from("table_sessions")
      .select("id, table_id, restaurant_tables(table_number)")
      .eq("status", "open");

    const liste: TableOption[] = (sessionRows ?? []).map((s: any) => ({
      id: s.table_id,
      table_number: s.restaurant_tables?.table_number ?? 0,
      sessionId: s.id,
    }));
    liste.sort((a, b) => a.table_number - b.table_number);
    setTablesList(liste);
    setSeciliTable(null);
    setTableItems([]);
    setTablesModalAcik(true);
  };

  const tableSec = async (table: TableOption) => {
    setSeciliTable(table);
    const { data: orderRows } = await supabase
      .from("orders")
      .select(
        "order_items(id, product_id, product_name_tr, quantity, unit_price_tl, split_group, products(source))"
      )
      .eq("table_session_id", table.sessionId);

    const items: TableItem[] = [];
    for (const order of orderRows ?? []) {
      for (const item of (order as any).order_items ?? []) {
        items.push({
          id: item.id,
          product_id: item.product_id,
          product_name_tr: item.product_name_tr,
          quantity: item.quantity,
          unit_price_tl: item.unit_price_tl,
          split_group: item.split_group,
          isMarket: item.products?.source === "ikas",
        });
      }
    }
    setTableItems(items);
    const baslangic: Record<string, number> = {};
    for (const it of items) baslangic[it.id] = 0;
    setCagriMiktarlari(baslangic);
  };

  const cagirMiktarDegistir = (itemId: string, deger: number, maxDeger: number) => {
    setCagriMiktarlari((c) => ({ ...c, [itemId]: Math.max(0, Math.min(deger, maxDeger)) }));
  };

  const secilenleriCagir = () => {
    if (!seciliTable) return;
    const yeniSatirlar: PosCartLine[] = [];
    for (const item of tableItems) {
      const miktar = cagriMiktarlari[item.id] ?? 0;
      if (miktar <= 0) continue;
      yeniSatirlar.push({
        key: yeniKey(),
        productId: item.product_id,
        name: item.product_name_tr,
        price: Number(item.unit_price_tl),
        quantity: miktar,
        isMarket: item.isMarket,
        fromTableOrderItemId: item.id,
        fromTableId: seciliTable.id,
      });
    }
    setPosCart((current) => [...current, ...yeniSatirlar]);
    // Çağrılanları yerel listeden düş (DB'ye henüz dokunmuyoruz — ödeme
    // tamamlanınca kalıcı olacak; iptal edilirse masa hiç etkilenmemiş olur).
    setTableItems((current) =>
      current
        .map((it) => ({ ...it, quantity: it.quantity - (cagriMiktarlari[it.id] ?? 0) }))
        .filter((it) => it.quantity > 0)
    );
    setCagriMiktarlari({});
    setTablesModalAcik(false);
  };

  const tumunuCagir = () => {
    const tumu: Record<string, number> = {};
    for (const item of tableItems) tumu[item.id] = item.quantity;
    setCagriMiktarlari(tumu);
    setTimeout(secilenleriCagir, 0);
  };

  const bolumuCagir = (grup: number) => {
    const secili: Record<string, number> = {};
    for (const item of tableItems) {
      if (item.split_group === grup) secili[item.id] = item.quantity;
    }
    setCagriMiktarlari(secili);
    setTimeout(secilenleriCagir, 0);
  };

  const mevcutBolumler = Array.from(
    new Set(tableItems.filter((i) => i.split_group != null).map((i) => i.split_group as number))
  ).sort();

  // ---------- Manuel ürün ekle ----------
  const manuelEkle = () => {
    const fiyat = Number(manuelFiyat);
    if (!manuelAd.trim() || !fiyat || fiyat <= 0) {
      alert("Ürün adı ve geçerli bir fiyat girin.");
      return;
    }
    setPosCart((current) => [
      ...current,
      {
        key: yeniKey(),
        productId: null,
        name: manuelAd.trim(),
        price: fiyat,
        quantity: 1,
        isMarket: true,
        fromTableOrderItemId: null,
        fromTableId: null,
      },
    ]);
    setManuelAd("");
    setManuelFiyat("");
    setManuelModalAcik(false);
  };

  // ---------- Sepet işlemleri ----------
  const sepettenSil = (key: string) => {
    // Masadan çağrılmış bir ürünse, DB'ye hiç dokunmadığımız için
    // sepetten silmek onu doğal olarak masada bırakmış (hiç almamış) olur.
    setPosCart((current) => current.filter((l) => l.key !== key));
  };

  const miktarDegistir = (key: string, delta: number) => {
    setPosCart((current) =>
      current
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const fiyatDegistir = (key: string, deger: string) => {
    const fiyat = Number(deger);
    if (isNaN(fiyat) || fiyat < 0) return;
    setPosCart((current) => current.map((l) => (l.key === key ? { ...l, price: fiyat } : l)));
  };

  // ---------- Toplamlar ----------
  const araToplam = posCart.reduce((s, l) => s + l.price * l.quantity, 0);
  const marketAraToplam = posCart.filter((l) => l.isMarket).reduce((s, l) => s + l.price * l.quantity, 0);

  const indirimTutari = (() => {
    if (indirimKapsam === "none") return 0;
    const deger = Number(indirimDeger) || 0;
    if (deger <= 0) return 0;
    const hedefToplam = indirimKapsam === "market" ? marketAraToplam : araToplam;
    if (hedefToplam <= 0) return 0;
    return indirimTip === "percent" ? hedefToplam * (deger / 100) : Math.min(deger, hedefToplam);
  })();

  const genelToplam = Math.max(0, araToplam - indirimTutari);
  const paraUstu = odemeYontemi === "nakit" ? (Number(alinanPara) || 0) - genelToplam : 0;

  // ---------- Ödeme ----------
  const odemeModalAc = async () => {
    if (posCart.length === 0) return;
    if (!bankInfo) {
      const { data } = await supabase
        .from("restaurant_settings")
        .select(
          "bank_tl_account_name, bank_tl_iban, bank_idr_bank, bank_idr_account_name, bank_idr_account_number"
        )
        .limit(1)
        .maybeSingle();
      if (data) {
        setBankInfo({
          tlAccountName: data.bank_tl_account_name ?? "",
          tlIban: data.bank_tl_iban ?? "",
          idrBank: data.bank_idr_bank ?? "",
          idrAccountName: data.bank_idr_account_name ?? "",
          idrAccountNumber: data.bank_idr_account_number ?? "",
        });
      }
    }
    setOdemeYontemi(null);
    setAlinanPara("");
    setOdemeModalAcik(true);
  };

  const odemeyiTamamla = async () => {
    if (!odemeYontemi) return;
    if (odemeYontemi === "nakit" && (Number(alinanPara) || 0) < genelToplam) {
      alert("Alınan para, toplam tutardan az olamaz.");
      return;
    }

    setKaydediliyor(true);

    // 1) Masadan çağrılan ürünleri gerçek masa siparişinden düş.
    const masaGuncellemeleri = new Map<string, number>();
    for (const line of posCart) {
      if (line.fromTableOrderItemId) {
        masaGuncellemeleri.set(
          line.fromTableOrderItemId,
          (masaGuncellemeleri.get(line.fromTableOrderItemId) ?? 0) + line.quantity
        );
      }
    }
    for (const [orderItemId] of masaGuncellemeleri) {
      const { data: mevcutItem } = await supabase
        .from("order_items")
        .select("quantity")
        .eq("id", orderItemId)
        .maybeSingle();
      const cagrilan = masaGuncellemeleri.get(orderItemId) ?? 0;
      const kalan = (mevcutItem?.quantity ?? 0) - cagrilan;
      if (kalan <= 0) {
        await supabase.from("order_items").delete().eq("id", orderItemId);
      } else {
        await supabase.from("order_items").update({ quantity: kalan }).eq("id", orderItemId);
      }
    }

    // 2) Yeni POS siparişini oluştur.
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        source: "pos",
        customer_name: "Resto POS",
        total_tl: genelToplam,
        total_idr: 0,
        payment_status: "paid",
        order_status: "completed",
        payment_method: odemeYontemi,
        cash_received: odemeYontemi === "nakit" ? Number(alinanPara) : null,
        discount_type: indirimKapsam === "none" ? null : indirimTip,
        discount_value: indirimKapsam === "none" ? null : Number(indirimDeger) || 0,
        discount_scope: indirimKapsam === "none" ? null : indirimKapsam,
      })
      .select("id, order_number")
      .single();

    if (orderError || !orderData) {
      alert("Sipariş kaydedilemedi.");
      setKaydediliyor(false);
      return;
    }

    await supabase.from("order_items").insert(
      posCart.map((l) => ({
        order_id: orderData.id,
        product_id: l.productId,
        product_name_tr: l.name,
        quantity: l.quantity,
        unit_price_tl: l.price,
        unit_price_idr: 0,
        options: [],
        item_note: null,
      }))
    );

    // 3) ikas'a gönder.
    await fetch("/api/ikas/push-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: orderData.id }),
    }).catch(() => {});

    setKaydediliyor(false);
    setOdemeModalAcik(false);

    if (otomatikYazdir) {
      setTimeout(() => {
        window.print();
      }, 150);
    }

    setPosCart([]);
    setIndirimKapsam("none");
    setIndirimDeger("");
  };

  const fisYazdir = () => {
    setYazdiriliyor(true);
    setTimeout(() => {
      window.print();
      setYazdiriliyor(false);
    }, 150);
  };

  return (
    <>
      <div className="ekran-icerigi min-h-screen bg-[#f3f1ed] text-[#231710]">
        <header className="sticky top-0 z-20 border-b border-[#e2ddd3] bg-white px-4 py-3 sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <h1 className="text-lg font-black">🧾 Resto POS</h1>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#5b4032]">
                <input
                  type="checkbox"
                  checked={otomatikYazdir}
                  onChange={(e) => otomatikYazdirDegistir(e.target.checked)}
                  className="h-4 w-4"
                />
                Otomatik Yazdır
              </label>
              <Link
                href="/admin"
                className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
              >
                ← Panele Dön
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-4 sm:px-8 lg:grid-cols-[1fr_260px]">
          {/* SOL: sepet */}
          <div className="rounded-2xl border border-[#e2ddd3] bg-white p-4">
            <input
              ref={barkodRef}
              value={barkodDeger}
              onChange={(e) => setBarkodDeger(e.target.value)}
              onKeyDown={barkodEnter}
              placeholder="📷 Barkod okutun..."
              autoFocus
              className="mb-3 w-full rounded-2xl border-2 border-[#ef2b1e] bg-[#fff8f2] px-4 py-3 text-sm font-bold outline-none"
            />

            {tarananHata && (
              <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                ⚠️ {tarananHata}
              </p>
            )}

            {posCart.length === 0 ? (
              <p className="py-10 text-center text-sm font-bold text-[#a18b7b]">
                Sepet boş — barkod okutun ya da sağdaki butonlarla ürün ekleyin.
              </p>
            ) : (
              <div className="space-y-2">
                {posCart.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#eee7db] p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{line.name}</span>
                        {line.fromTableOrderItemId && (
                          <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-700">
                            MASA
                          </span>
                        )}
                      </div>
                      {line.isMarket ? (
                        <input
                          type="number"
                          value={line.price}
                          onChange={(e) => fiyatDegistir(line.key, e.target.value)}
                          className="mt-1 w-24 rounded-lg border border-[#e5d4c2] px-1.5 py-1 text-xs font-bold"
                        />
                      ) : (
                        <span className="text-xs text-[#7a6f63]">
                          {line.price.toLocaleString("tr-TR")} TL
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => miktarDegistir(line.key, -1)}
                        className="h-7 w-7 rounded-full border border-[#e5d4c2] text-sm font-black"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-black">{line.quantity}</span>
                      <button
                        onClick={() => miktarDegistir(line.key, 1)}
                        className="h-7 w-7 rounded-full border border-[#e5d4c2] text-sm font-black"
                      >
                        +
                      </button>
                      <button
                        onClick={() => sepettenSil(line.key)}
                        className="ml-1 rounded-full border border-red-300 px-2 py-1 text-[10px] font-bold text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {posCart.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-[#eee7db] pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={indirimKapsam}
                    onChange={(e) => setIndirimKapsam(e.target.value as any)}
                    className="rounded-xl border border-[#e5d4c2] px-2 py-1.5 text-xs font-bold"
                  >
                    <option value="none">İndirim Yok</option>
                    <option value="general">Genel İndirim</option>
                    <option value="market">Sadece Market İndirimi</option>
                  </select>
                  {indirimKapsam !== "none" && (
                    <>
                      <select
                        value={indirimTip}
                        onChange={(e) => setIndirimTip(e.target.value as any)}
                        className="rounded-xl border border-[#e5d4c2] px-2 py-1.5 text-xs font-bold"
                      >
                        <option value="percent">%</option>
                        <option value="fixed">₺</option>
                      </select>
                      <input
                        type="number"
                        value={indirimDeger}
                        onChange={(e) => setIndirimDeger(e.target.value)}
                        placeholder="Değer"
                        className="w-24 rounded-xl border border-[#e5d4c2] px-2 py-1.5 text-xs font-bold"
                      />
                    </>
                  )}
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-[#7a6f63]">Ara Toplam</span>
                  <span className="font-bold">{araToplam.toLocaleString("tr-TR")} TL</span>
                </div>
                {indirimTutari > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>İndirim</span>
                    <span className="font-bold">-{indirimTutari.toLocaleString("tr-TR")} TL</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-black">
                  <span>Toplam</span>
                  <span>{genelToplam.toLocaleString("tr-TR")} TL</span>
                </div>
              </div>
            )}
          </div>

          {/* SAĞ: butonlar */}
          <div className="space-y-2">
            <button
              onClick={menuModalAc}
              className="w-full rounded-2xl border border-[#e2ddd3] bg-white p-4 text-left text-sm font-black"
            >
              🍽️ Menü
            </button>
            <button
              onClick={tablesModalAc}
              className="w-full rounded-2xl border border-[#e2ddd3] bg-white p-4 text-left text-sm font-black"
            >
              🪑 Masalar
            </button>
            <button
              onClick={() => setManuelModalAcik(true)}
              className="w-full rounded-2xl border border-[#e2ddd3] bg-white p-4 text-left text-sm font-black"
            >
              ✏️ Manuel Ürün Ekle
            </button>
            <button
              onClick={() => {
                setFiyatGorModu((v) => !v);
                setFiyatGorSonuc(null);
              }}
              className={`w-full rounded-2xl p-4 text-left text-sm font-black ${
                fiyatGorModu ? "bg-blue-600 text-white" : "border border-[#e2ddd3] bg-white"
              }`}
            >
              {fiyatGorModu ? "← Satışa Dön" : "💲 Fiyat Gör"}
            </button>
            <button
              onClick={fisYazdir}
              disabled={posCart.length === 0}
              className="w-full rounded-2xl border border-[#e2ddd3] bg-white p-4 text-left text-sm font-black disabled:opacity-40"
            >
              🖨️ Fiş Yazdır
            </button>
            <button
              onClick={odemeModalAc}
              disabled={posCart.length === 0}
              className="w-full rounded-2xl bg-[#231710] p-4 text-left text-sm font-black text-white disabled:opacity-40"
            >
              💳 Ödemeyi Tamamla
            </button>
          </div>
        </div>

        {/* Fiyat Gör overlay */}
        {fiyatGorModu && fiyatGorSonuc && (
          <div
            onClick={() => setFiyatGorSonuc(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          >
            <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
              {fiyatGorSonuc === "bulunamadi" ? (
                <p className="font-bold text-red-600">Ürün bulunamadı.</p>
              ) : (
                <>
                  <div className="text-lg font-bold text-[#5b4032]">{fiyatGorSonuc.ad}</div>
                  <div className="mt-3 text-4xl font-black text-[#ef2b1e]">
                    {fiyatGorSonuc.fiyat.toLocaleString("tr-TR")} TL
                  </div>
                </>
              )}
              <p className="mt-4 text-xs text-[#a18b7b]">Kapatmak için dokunun</p>
            </div>
          </div>
        )}

        {/* Menü modalı */}
        {menuModalAcik && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-black">Menüden Ekle</h3>
                <button
                  onClick={() => setMenuModalAcik(false)}
                  className="rounded-full border border-[#e4d3c1] px-3 py-1.5 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <input
                value={menuArama}
                onChange={(e) => setMenuArama(e.target.value)}
                placeholder="Ürün ara..."
                className="mb-3 w-full rounded-2xl border border-[#e5d4c2] px-4 py-2.5 text-sm outline-none focus:border-[#ef2b1e]"
              />
              <div
                className={`mb-3 flex gap-2 overflow-x-auto pb-2 ${
                  menuArama.trim() ? "opacity-40" : ""
                }`}
              >
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setMenuArama("");
                      setAktifKategori(c.id);
                    }}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                      aktifKategori === c.id && !menuArama.trim()
                        ? "bg-[#ef2b1e] text-white"
                        : "border border-[#e5d4c2] text-[#5b4032]"
                    }`}
                  >
                    {c.emoji} {c.name_tr}
                  </button>
                ))}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {menuGosterilenUrunler.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => menuUrunEkle(p)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#eee7db] px-3 py-2.5 text-left"
                  >
                    <span className="text-sm font-bold">{p.name_tr}</span>
                    <span className="text-xs font-bold text-[#7a6f63]">
                      {Number(p.price_tl).toLocaleString("tr-TR")} TL
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Masalar modalı */}
        {tablesModalAcik && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-black">
                  {seciliTable ? `Masa ${seciliTable.table_number}` : "Masa Seç"}
                </h3>
                <button
                  onClick={() => setTablesModalAcik(false)}
                  className="rounded-full border border-[#e4d3c1] px-3 py-1.5 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {!seciliTable ? (
                <div className="grid grid-cols-3 gap-2">
                  {tablesList.length === 0 && (
                    <p className="col-span-3 text-center text-sm font-bold text-[#a18b7b]">
                      Açık masa yok.
                    </p>
                  )}
                  {tablesList.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => tableSec(t)}
                      className="rounded-2xl border border-[#e5d4c2] p-4 text-center font-black"
                    >
                      Masa {t.table_number}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      onClick={tumunuCagir}
                      disabled={tableItems.length === 0}
                      className="rounded-full bg-[#231710] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      Tümünü Çağır
                    </button>
                    {mevcutBolumler.map((g) => (
                      <button
                        key={g}
                        onClick={() => bolumuCagir(g)}
                        className="rounded-full border border-blue-400 px-3 py-1.5 text-xs font-bold text-blue-700"
                      >
                        Bölüm {g}'i Çağır
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {tableItems.length === 0 && (
                      <p className="text-center text-sm font-bold text-[#a18b7b]">
                        Bu masada ürün kalmadı.
                      </p>
                    )}
                    {tableItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[#eee7db] p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">{item.product_name_tr}</div>
                          <div className="text-xs text-[#7a6f63]">
                            Masada: {item.quantity} adet
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() =>
                              cagirMiktarDegistir(
                                item.id,
                                (cagriMiktarlari[item.id] ?? 0) - 1,
                                item.quantity
                              )
                            }
                            className="h-7 w-7 rounded-full border border-[#e5d4c2] text-sm font-black"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-sm font-black">
                            {cagriMiktarlari[item.id] ?? 0}
                          </span>
                          <button
                            onClick={() =>
                              cagirMiktarDegistir(
                                item.id,
                                (cagriMiktarlari[item.id] ?? 0) + 1,
                                item.quantity
                              )
                            }
                            className="h-7 w-7 rounded-full border border-[#e5d4c2] text-sm font-black"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={secilenleriCagir}
                    disabled={Object.values(cagriMiktarlari).every((v) => v === 0)}
                    className="mt-3 w-full rounded-2xl bg-[#231710] py-3 text-sm font-black text-white disabled:opacity-40"
                  >
                    Seçilenleri POS'a Çağır
                  </button>
                  <button
                    onClick={() => setSeciliTable(null)}
                    className="mt-2 w-full rounded-2xl border border-[#e4d3c1] py-2.5 text-xs font-bold"
                  >
                    ← Masa Listesine Dön
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Manuel ürün ekle modalı */}
        {manuelModalAcik && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
              <h3 className="mb-4 text-lg font-black">Manuel Ürün Ekle</h3>
              <div className="space-y-3">
                <input
                  value={manuelAd}
                  onChange={(e) => setManuelAd(e.target.value)}
                  placeholder="Ürün adı"
                  className="w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={manuelFiyat}
                  onChange={(e) => setManuelFiyat(e.target.value)}
                  placeholder="Fiyat (TL)"
                  className="w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setManuelModalAcik(false)}
                  className="flex-1 rounded-2xl border border-[#e4d3c1] py-3 text-sm font-bold"
                >
                  Vazgeç
                </button>
                <button
                  onClick={manuelEkle}
                  className="flex-1 rounded-2xl bg-[#231710] py-3 text-sm font-black text-white"
                >
                  Ekle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ödeme modalı */}
        {odemeModalAcik && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
              <h3 className="mb-1 text-lg font-black">Ödemeyi Tamamla</h3>
              <p className="mb-4 text-2xl font-black text-[#ef2b1e]">
                {genelToplam.toLocaleString("tr-TR")} TL
              </p>

              <div className="mb-3 flex gap-2">
                {(["nakit", "kart", "havale"] as const).map((y) => (
                  <button
                    key={y}
                    onClick={() => setOdemeYontemi(y)}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-black capitalize ${
                      odemeYontemi === y
                        ? "bg-[#231710] text-white"
                        : "border border-[#e5d4c2] text-[#5b4032]"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {odemeYontemi === "nakit" && (
                <div className="space-y-2">
                  <input
                    type="number"
                    value={alinanPara}
                    onChange={(e) => setAlinanPara(e.target.value)}
                    placeholder="Alınan Para"
                    className="w-full rounded-xl border border-[#e5d4c2] px-3 py-2.5 text-sm font-bold"
                  />
                  <div className="flex justify-between text-sm font-bold">
                    <span>Para Üstü</span>
                    <span className={paraUstu < 0 ? "text-red-600" : "text-green-700"}>
                      {paraUstu.toLocaleString("tr-TR")} TL
                    </span>
                  </div>
                </div>
              )}

              {odemeYontemi === "havale" && bankInfo && (
                <div className="space-y-2 rounded-xl bg-[#faf5ee] p-3 text-xs">
                  <div>
                    <div className="font-black">TL Hesabı</div>
                    <div>{bankInfo.tlAccountName}</div>
                    <div className="font-mono">{bankInfo.tlIban}</div>
                  </div>
                  <div>
                    <div className="font-black">IDR Hesabı</div>
                    <div>
                      {bankInfo.idrBank} — {bankInfo.idrAccountName}
                    </div>
                    <div className="font-mono">{bankInfo.idrAccountNumber}</div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setOdemeModalAcik(false)}
                  className="flex-1 rounded-2xl border border-[#e4d3c1] py-3 text-sm font-bold"
                >
                  Vazgeç
                </button>
                <button
                  onClick={odemeyiTamamla}
                  disabled={!odemeYontemi || kaydediliyor}
                  className="flex-1 rounded-2xl bg-[#231710] py-3 text-sm font-black text-white disabled:opacity-40"
                >
                  {kaydediliyor ? "Kaydediliyor..." : "Onayla"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fiş yazdırma alanı */}
      {yazdiriliyor && (
        <div id="pos-fisi-yazdirma" style={{ display: "none" }}>
          <style>{`
            @media print {
              .ekran-icerigi { display: none !important; }
              #pos-fisi-yazdirma { display: block !important; }
              @page { size: 102mm 152mm; margin: 5mm; }
            }
          `}</style>
          <div style={{ fontFamily: "Arial, sans-serif", color: "#000", fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>INDOTURKI RESTO</div>
              <div style={{ fontSize: 11 }}>SATIŞ FİŞİ</div>
            </div>
            <p style={{ margin: 0 }}>{new Date().toLocaleString("tr-TR")}</p>
            <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", marginTop: 8 }}>
              {posCart.map((l) => (
                <div key={l.key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>
                    {l.quantity}x {l.name}
                  </span>
                  <span>{(l.price * l.quantity).toLocaleString("tr-TR")} TL</span>
                </div>
              ))}
            </div>
            {indirimTutari > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span>İndirim</span>
                <span>-{indirimTutari.toLocaleString("tr-TR")} TL</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 6, fontSize: 14 }}>
              <span>Toplam</span>
              <span>{genelToplam.toLocaleString("tr-TR")} TL</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
