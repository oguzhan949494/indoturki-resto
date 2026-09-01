"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isRestaurantOpen, type RestaurantHoursSettings } from "@/utils/restaurant-hours";
import Link from "next/link";
import {
  ALL_CATEGORY_ID,
  categoryAllowsExtraNoodle,
  categoryIsBeverage,
  categoryAllowsNoodleTypeChoice,
  categoryAllowsExtraPilav,
  formatTL,
  lineOptionCodes,
  lineUnitPrice,
  mapCategories,
  mapProducts,
  OPTION_LABELS,
  type CartLine,
  type Category,
  type Product,
} from "@/utils/menu-types";

function Spice({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-1 text-[11px]" title={`Acılık: ${count}/5`}>
      {"🌶️".repeat(Math.min(count, 5))}
    </span>
  );
}

const CALL_TYPES = [
  { id: "garson", tr: "Garson", id_: "Pelayan", emoji: "🙋" },
  { id: "hesap", tr: "Hesap", id_: "Bill", emoji: "🧾" },
  { id: "su", tr: "Su", id_: "Air", emoji: "💧" },
  { id: "diger", tr: "Diğer", id_: "Lainnya", emoji: "🔔" },
] as const;

function TableMenu() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const masaParam = searchParams.get("masa");
  const tableNumber = masaParam ? Number(masaParam) : null;

  const [lang, setLang] = useState<"tr" | "id">("id");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableSessionId, setTableSessionId] = useState<string | null>(null);
  const [tableError, setTableError] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY_ID);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [note, setNote] = useState("");

  const [callOpen, setCallOpen] = useState(false);
  const [callSending, setCallSending] = useState(false);
  const [callSent, setCallSent] = useState<string | null>(null);

  // Yeni giriş akışı: yükleniyor -> (kapalıysa) uyarı -> seçim ekranı -> sipariş.
  const [entryStage, setEntryStage] = useState<
    "loading" | "closedNotice" | "choice" | "ordering"
  >("loading");
  const [orderMode, setOrderMode] = useState<"dinein" | "takeaway" | null>(null);
  const [restaurantOpen, setRestaurantOpen] = useState(true);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableDetailItems, setTableDetailItems] = useState<
    { id: string; name: string; quantity: number; price: number; isMarket: boolean }[]
  >([]);
  const [tableDetailOpen, setTableDetailOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      if (tableNumber) {
        const { data: tableRow, error: tableErr } = await supabase
          .from("restaurant_tables")
          .select("id, table_number, is_active")
          .eq("table_number", tableNumber)
          .maybeSingle();

        if (tableErr || !tableRow || !tableRow.is_active) {
          setTableError(true);
        } else {
          setTableId(tableRow.id as string);

          // Bu masanın açık bir oturumu var mı bak; yoksa yeni bir tane aç.
          // Personel "Masayı Sıfırla" demedikçe, bu masadan gelen tüm
          // siparişler aynı oturuma bağlanmaya devam eder.
          const { data: existingSession } = await supabase
            .from("table_sessions")
            .select("id")
            .eq("table_id", tableRow.id)
            .eq("status", "open")
            .order("opened_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingSession?.id) {
            setTableSessionId(existingSession.id as string);
          } else {
            const { data: newSession } = await supabase
              .from("table_sessions")
              .insert({ table_id: tableRow.id, status: "open" })
              .select("id")
              .single();
            if (newSession?.id) setTableSessionId(newSession.id as string);
          }
        }
      } else {
        setTableError(true);
      }

      const { data: categoryData } = await supabase
        .from("categories")
        .select("id, name_tr, name_id, emoji, sort_order, section")
        .eq("is_active", true)
        .eq("section", "menu")
        .order("sort_order", { ascending: true });

      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("is_available", true)
        .eq("section", "menu")
        .order("sort_order", { ascending: true });

      setCategories(mapCategories(categoryData));
      setProducts(mapProducts(productData));

      const { data: hoursData } = await supabase
        .from("restaurant_settings")
        .select("opening_time, closing_time, manual_status")
        .limit(1)
        .maybeSingle();
      const open = isRestaurantOpen(hoursData as RestaurantHoursSettings | null);
      setRestaurantOpen(open);

      setLoading(false);
      setEntryStage(open ? "choice" : "closedNotice");
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNumber]);

  // Masanın açık oturumundaki toplam tutarı ve ürünleri çeker (müşteriye
  // "bu masanın toplamı" olarak gösterebilmek için).
  const loadTableTotal = async (sessionId: string) => {
    const { data: orderRows } = await supabase
      .from("orders")
      .select(
        "order_items ( id, quantity, unit_price_tl, product_name_tr, product_id, products ( source ) )"
      )
      .eq("table_session_id", sessionId);

    const items: { id: string; name: string; quantity: number; price: number; isMarket: boolean }[] = [];
    let total = 0;
    for (const order of orderRows ?? []) {
      for (const item of (order as any).order_items ?? []) {
        items.push({
          id: item.id,
          name: item.product_name_tr,
          quantity: item.quantity,
          price: item.unit_price_tl,
          isMarket: item.products?.source === "ikas",
        });
        total += item.unit_price_tl * item.quantity;
      }
    }
    setTableDetailItems(items);
    setTableTotal(total);
  };

  useEffect(() => {
    if (tableSessionId) {
      loadTableTotal(tableSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableSessionId]);

  const tr = {
    menuSearch: lang === "tr" ? "Menüde ara..." : "Cari di menu...",
    cart: lang === "tr" ? "Sepet" : "Keranjang",
    tableLabel: lang === "tr" ? "Masa" : "Meja",
    add: lang === "tr" ? "Sepete Ekle" : "Tambah ke keranjang",
    wantSambal: lang === "tr" ? "Sambal sos istiyorum" : "Saya ingin sambal",
    extraPilav: lang === "tr" ? "Ekstra Pilav (150g) +50₺" : "Tambah Nasi (150g) +50₺",
    extraNoodle: lang === "tr" ? "Ekstra Noodle (75g) +50₺" : "Tambah Mie (75g) +50₺",
    noodleTypeLabel: lang === "tr" ? "Noodle / Bihun Tercihi" : "Pilihan Mie / Bihun",
    sambalTitle: lang === "tr" ? "Ücretsiz Sambal Sos" : "Sambal Gratis",
    noProduct: lang === "tr" ? "Ürün bulunamadı." : "Produk tidak ditemukan.",
    showMenu: lang === "tr" ? "Menüyü göster" : "Tampilkan menu",
    yourCart: lang === "tr" ? "Sepetiniz" : "Keranjang Anda",
    checkout: lang === "tr" ? "Siparişi Gönder" : "Kirim Pesanan",
    emptyCart: lang === "tr" ? "Sepetiniz boş." : "Keranjang Anda kosong.",
    increase: lang === "tr" ? "Artır" : "Tambah",
    decrease: lang === "tr" ? "Azalt" : "Kurangi",
    totalTL: lang === "tr" ? "Toplam" : "Total",
    note: lang === "tr" ? "Sipariş notu (opsiyonel)" : "Catatan pesanan (opsional)",
    finish: lang === "tr" ? "Siparişi Mutfağa Gönder" : "Kirim Pesanan ke Dapur",
    submitting: lang === "tr" ? "Gönderiliyor..." : "Mengirim...",
    orderReceived: lang === "tr" ? "Siparişiniz mutfağa iletildi!" : "Pesanan Anda telah dikirim ke dapur!",
    orderNo: lang === "tr" ? "Sipariş No" : "Nomor Pesanan",
    orderReceivedText:
      lang === "tr"
        ? "Siparişiniz hazırlanmaya başlanacak. Afiyet olsun!"
        : "Pesanan Anda akan segera disiapkan. Selamat menikmati!",
    close: lang === "tr" ? "Kapat" : "Tutup",
    callStaff: lang === "tr" ? "Personel Çağır" : "Panggil Pelayan",
    callTitle: lang === "tr" ? "Ne için çağırıyorsunuz?" : "Anda memanggil untuk apa?",
    callSentText: lang === "tr" ? "Çağrınız iletildi, birazdan geliyoruz." : "Panggilan Anda diterima, kami segera datang.",
    tableNotFound:
      lang === "tr"
        ? "Bu masa bulunamadı. Lütfen QR kodu tekrar okutun veya personelden yardım isteyin."
        : "Meja ini tidak ditemukan. Silakan pindai ulang QR atau minta bantuan staf.",
    loadingMenu: lang === "tr" ? "Menü yükleniyor..." : "Memuat menu...",
    goCart: lang === "tr" ? "Sepete Git →" : "Lihat Keranjang →",
    cartItems: lang === "tr" ? "ürün" : "produk",
  };

  const categoryName = (category: Category) => (lang === "tr" ? category.nameTr : category.nameId);
  const productName = (product: Product) => (lang === "tr" ? product.nameTr : product.nameId);
  const productDescription = (product: Product) =>
    lang === "tr" ? product.descriptionTr : product.descriptionId;

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    const categorySortMap = new Map(categories.map((c) => [c.id, c.sortOrder]));
    return products
      .filter((product) => {
        const categoryMatch =
          activeCategory === ALL_CATEGORY_ID || product.categoryId === activeCategory;
        const name = productName(product).toLocaleLowerCase("tr-TR");
        const searchMatch = !q || name.includes(q);
        return categoryMatch && searchMatch;
      })
      .sort((a, b) => {
        const catA = categorySortMap.get(a.categoryId) ?? 0;
        const catB = categorySortMap.get(b.categoryId) ?? 0;
        if (catA !== catB) return catA - catB;
        return a.sortOrder - b.sortOrder;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, search, products, lang, categories]);

  // Stok takibi olan ürünlerde (menü ya da market fark etmez), stoktan
  // fazlası sepete eklenemez. Stok takibi yoksa (stockQuantity boş) sınırsız.
  const maxQtyFor = (product: Product) =>
    product.stockQuantity != null ? product.stockQuantity : Infinity;

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      const maxQty = maxQtyFor(product);
      if (existing) {
        if (existing.quantity >= maxQty) {
          alert(
            lang === "tr" ? `Stokta sadece ${maxQty} adet var.` : `Stok tersedia hanya ${maxQty}.`
          );
          return current;
        }
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      if (maxQty < 1) {
        alert(lang === "tr" ? "Bu ürün stokta yok." : "Produk ini habis.");
        return current;
      }
      const catName = categoryNameForProduct(product);
      const isBeverage = categoryIsBeverage(catName);
      const noodleType = categoryAllowsNoodleTypeChoice(catName) ? "noodle150" : null;
      return [
        ...current,
        {
          product,
          quantity: 1,
          note: "",
          sambal: !isBeverage,
          extraPilav: false,
          extraNoodle: false,
          noodleType,
        },
      ];
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) => {
          if (line.product.id !== productId) return line;
          const maxQty = maxQtyFor(line.product);
          const nextQty = Math.min(Math.max(0, line.quantity + delta), maxQty);
          return { ...line, quantity: nextQty };
        })
        .filter((line) => line.quantity > 0)
    );
  };

  const updateCartLine = (productId: string, patch: Partial<CartLine>) => {
    setCart((current) =>
      current.map((line) =>
        line.product.id === productId ? { ...line, ...patch } : line
      )
    );
  };

  const categoryNameForProduct = (product: Product) =>
    categories.find((c) => c.id === product.categoryId)?.nameTr ?? "";

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, line) => sum + lineUnitPrice(line) * line.quantity,
    0
  );

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cart.length === 0 || submitting || !tableId) return;
    setSubmitting(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          source: "table",
          table_id: tableId,
          table_session_id: tableSessionId,
          is_takeaway: orderMode === "takeaway",
          total_tl: cartTotal,
          total_idr: 0,
          sambal_requested: cart.some((line) => line.sambal),
          payment_status: "pending",
          order_status: "new",
          delivery_address: note || null,
        })
        .select("id, order_number")
        .single();

      if (orderError || !orderData) {
        console.error("MASA SİPARİŞ HATASI:", orderError);
        alert(lang === "tr" ? "Sipariş gönderilemedi." : "Pesanan gagal dikirim.");
        return;
      }

      const orderItems = cart.map((line) => ({
        order_id: orderData.id,
        product_id: line.product.id,
        product_name_tr: line.product.nameTr,
        product_name_id: line.product.nameId,
        quantity: line.quantity,
        unit_price_tl: lineUnitPrice(line),
        unit_price_idr: 0,
        options: lineOptionCodes(line),
        item_note: line.note?.trim() || null,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) {
        console.error("MASA SİPARİŞ ÜRÜN HATASI:", itemsError);
        alert(lang === "tr" ? "Sipariş ürünleri gönderilemedi." : "Item pesanan gagal dikirim.");
        return;
      }

      setOrderNumber(`ID-${orderData.order_number}`);
      setOrderComplete(true);
      setCart([]);
      setNote("");
    } finally {
      setSubmitting(false);
    }
  };

  const sendStaffCall = async (callType: string) => {
    if (!tableId || callSending) return;
    setCallSending(true);
    try {
      const { error } = await supabase.from("staff_calls").insert({
        table_id: tableId,
        call_type: callType,
        status: "waiting",
      });
      if (error) {
        console.error("PERSONEL ÇAĞRI HATASI:", error);
        alert(lang === "tr" ? "Çağrı gönderilemedi." : "Panggilan gagal dikirim.");
        return;
      }
      setCallSent(callType);
      setTimeout(() => {
        setCallSent(null);
        setCallOpen(false);
      }, 1800);
    } finally {
      setCallSending(false);
    }
  };

  if (!loading && tableError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7eee3] p-6 text-center text-[#231710]">
        <div className="max-w-sm rounded-3xl border border-[#e6d5c4] bg-white p-8 shadow-lg">
          <div className="text-4xl">⚠️</div>
          <p className="mt-4 font-bold">{tr.tableNotFound}</p>
        </div>
      </main>
    );
  }

  if (entryStage === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7eee3] text-[#231710]">
        <p className="font-bold text-[#806b5b]">
          {lang === "tr" ? "Yükleniyor..." : "Memuat..."}
        </p>
      </main>
    );
  }

  if (entryStage === "closedNotice") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7eee3] p-6 text-[#231710]">
        <div className="max-w-sm rounded-3xl border border-[#e6d5c4] bg-white p-8 text-center shadow-lg">
          <div className="text-4xl">🕐</div>
          <h1 className="mt-4 text-lg font-black">
            {lang === "tr" ? "Mutfak şu anda kapalı" : "Dapur sedang tutup"}
          </h1>
          <p className="mt-2 text-sm text-[#806b5b]">
            {lang === "tr"
              ? "Dilerseniz Al-Götür için ileri tarihli sipariş oluşturabilirsiniz."
              : "Anda tetap dapat membuat pesanan ambil sendiri untuk waktu mendatang."}
          </p>
          <button
            onClick={() => setEntryStage("choice")}
            className="mt-6 w-full rounded-2xl bg-[#231710] py-3 text-sm font-black text-white"
          >
            {lang === "tr" ? "Tamam" : "Oke"}
          </button>
        </div>
      </main>
    );
  }

  if (entryStage === "choice") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7eee3] p-6 text-[#231710]">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef2b1e] text-2xl shadow-sm">
              🍽️
            </div>
            <h1 className="text-lg font-black">
              {tr.tableLabel} {tableNumber}
            </h1>
          </div>

          {tableTotal > 0 && (
            <button
              onClick={() => setTableDetailOpen(true)}
              className="mb-4 w-full rounded-2xl border border-[#e6d5c4] bg-white p-4 text-left shadow-sm"
            >
              <div className="text-xs font-bold text-[#806b5b]">
                {lang === "tr" ? "Bu masanın toplamı" : "Total meja ini"}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-black text-[#ef2b1e]">
                  {tableTotal.toLocaleString("tr-TR")} TL
                </span>
                <span className="text-xs font-bold underline">
                  {lang === "tr" ? "Detayı Gör" : "Lihat Detail"}
                </span>
              </div>
            </button>
          )}

          <div className="space-y-3">
            <button
              onClick={() => {
                if (!restaurantOpen) return;
                setOrderMode("dinein");
                setEntryStage("ordering");
              }}
              disabled={!restaurantOpen}
              className="w-full rounded-3xl bg-[#231710] p-6 text-left text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="text-3xl">🍽️</div>
              <div className="mt-2 text-lg font-black">
                {lang === "tr" ? "Restoranda Yiyeceğim" : "Makan di Tempat"}
              </div>
              {!restaurantOpen && (
                <div className="mt-1 text-xs font-bold text-white/70">
                  {lang === "tr" ? "Mutfak kapalı" : "Dapur tutup"}
                </div>
              )}
            </button>

            <button
              onClick={() => {
                setOrderMode("takeaway");
                setEntryStage("ordering");
              }}
              className="w-full rounded-3xl border-2 border-[#231710] bg-white p-6 text-left text-[#231710] shadow-lg"
            >
              <div className="text-3xl">🥡</div>
              <div className="mt-2 text-lg font-black">
                {lang === "tr" ? "Al-Götür" : "Bawa Pulang"}
              </div>
            </button>
          </div>
        </div>

        {tableDetailOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-3xl bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={() => setTableDetailOpen(false)}
                  className="rounded-full border border-[#e4d3c1] px-3 py-1.5 text-xs font-bold text-[#5b4032]"
                >
                  ← {lang === "tr" ? "Geri" : "Kembali"}
                </button>
                <h3 className="text-sm font-black">
                  {tr.tableLabel} {tableNumber}
                </h3>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {tableDetailItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-[#eee7db] px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-bold">
                        {item.quantity}x {item.name}
                      </div>
                      <div className="text-xs text-[#806b5b]">
                        {(item.price * item.quantity).toLocaleString("tr-TR")} TL
                      </div>
                    </div>
                    {item.isMarket ? (
                      <button
                        onClick={async () => {
                          await supabase.from("order_items").delete().eq("id", item.id);
                          if (tableSessionId) loadTableTotal(tableSessionId);
                        }}
                        className="rounded-full border border-red-300 px-2 py-1 text-xs font-bold text-red-600"
                      >
                        🗑️
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-[#a18b7b]">
                        {lang === "tr" ? "personele danışın" : "hubungi staf"}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-[#eee7db] pt-3 text-sm font-black">
                <span>{lang === "tr" ? "Toplam" : "Total"}</span>
                <span>{tableTotal.toLocaleString("tr-TR")} TL</span>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7eee3] text-[#231710]">
      <header className="sticky top-0 z-30 border-b border-[#e8d8c7] bg-[#fffaf4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ef2b1e] text-xl shadow-sm">
              🇮🇩
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-[#ef2b1e]">INDOTURKI</div>
              <div className="-mt-1 text-[9px] font-bold uppercase tracking-[0.35em] text-[#4d2d20]">
                {tr.tableLabel} {tableNumber}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-[#e4d3c1] bg-white p-1 text-[11px] font-black">
              <button
                onClick={() => setLang("tr")}
                className={`rounded-full px-2.5 py-1.5 transition ${lang === "tr" ? "bg-[#ef2b1e] text-white" : "text-[#6d5547]"}`}
              >
                🇹🇷
              </button>
              <button
                onClick={() => setLang("id")}
                className={`rounded-full px-2.5 py-1.5 transition ${lang === "id" ? "bg-[#ef2b1e] text-white" : "text-[#6d5547]"}`}
              >
                🇮🇩
              </button>
            </div>
            <button
              onClick={() => setCheckoutOpen(true)}
              className="relative rounded-full bg-[#231710] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
            >
              🛒 {tr.cart}
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ef2b1e] px-1 text-xs font-black">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr.menuSearch}
              className="w-full rounded-2xl border border-[#e4d3c1] bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[#ef2b1e] focus:ring-2 focus:ring-[#ef2b1e]/10"
            />
          </div>
        </div>

        <div className="overflow-x-auto border-t border-[#eee1d4] bg-[#fffaf4]">
          <div className="mx-auto flex max-w-6xl gap-2 px-4 py-2.5 sm:px-6">
            <button
              onClick={() => setActiveCategory(ALL_CATEGORY_ID)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
                activeCategory === ALL_CATEGORY_ID
                  ? "bg-[#ef2b1e] text-white shadow-sm"
                  : "border border-[#e5d6c7] bg-white text-[#5b4032]"
              }`}
            >
              ✨ {lang === "tr" ? "Tümü" : "Semua"}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
                  activeCategory === category.id
                    ? "bg-[#ef2b1e] text-white shadow-sm"
                    : "border border-[#e5d6c7] bg-white text-[#5b4032]"
                }`}
              >
                <span>{category.emoji}</span>
                {categoryName(category)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-4 pt-5 sm:px-6">
        <div className="rounded-2xl border border-[#e8d7c5] bg-[#fffaf3] p-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌶️</div>
            <div>
              <div className="text-sm font-black">{tr.sambalTitle}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-32 sm:px-6">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-[#d8c5b2] bg-white/60 p-12 text-center">
            <p className="font-bold">{tr.loadingMenu}</p>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d8c5b2] bg-white/60 p-12 text-center">
            <div className="text-4xl">🔎</div>
            <p className="mt-3 font-bold">{tr.noProduct}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="rounded-[26px] border border-[#e6d5c4] bg-[#fffaf5] p-4 shadow-[0_8px_30px_rgba(84,47,27,.06)]"
              >
                <div className="flex items-start gap-3">
                  {product.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={productName(product)}
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                    />
                  )}
                  <div className="flex flex-1 items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black leading-tight">
                        {productName(product)}
                        <Spice count={product.spicy} />
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-[#806b5b]">
                        {productDescription(product)}
                      </p>
                      {product.stockQuantity != null && (
                        <p
                          className={`mt-1 text-[11px] font-bold ${
                            product.stockQuantity > 0 ? "text-[#a05a2c]" : "text-red-600"
                          }`}
                        >
                          {product.stockQuantity > 0
                            ? lang === "tr"
                              ? `Stokta ${product.stockQuantity} adet`
                              : `Stok tersedia: ${product.stockQuantity}`
                            : lang === "tr"
                              ? "Stokta yok"
                              : "Stok habis"}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 rounded-full border border-[#d9c2ae] bg-white px-3 py-1.5 text-sm font-black">
                      {formatTL(product.price)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => addToCart(product)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ef2b1e] py-3 text-sm font-black text-white transition hover:bg-[#d92217] active:scale-[.98]"
                >
                  + {tr.add}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-32 pt-4 text-center sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-bold text-[#a18b7b]">
          <Link href="/mesafeli-satis-sozlesmesi" className="underline">
            Mesafeli Satış Sözleşmesi
          </Link>
          <Link href="/iptal-iade-politikasi" className="underline">
            İptal ve İade Politikası
          </Link>
          <Link href="/iletisim" className="underline">
            Adres ve İletişim
          </Link>
        </div>
      </footer>

      {/* Sabit alt bar: personel çağır + fiyat gör + sepet özeti */}
      <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-24px)] max-w-lg gap-2 -translate-x-1/2">
        <button
          onClick={() => setCallOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-black text-[#231710] shadow-[0_18px_45px_rgba(35,23,16,.25)] border border-[#e5d4c2]"
        >
          🔔 <span className="hidden sm:inline">{tr.callStaff}</span>
        </button>
        <Link
          href={`/fiyat-sor?masa=${tableNumber}`}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-black text-[#231710] shadow-[0_18px_45px_rgba(35,23,16,.25)] border border-[#e5d4c2]"
        >
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="0" y="0" width="1.5" height="16" fill="#231710" />
            <rect x="2.5" y="0" width="1" height="16" fill="#231710" />
            <rect x="4.5" y="0" width="2" height="16" fill="#231710" />
            <rect x="7.5" y="0" width="1" height="16" fill="#231710" />
            <rect x="9.5" y="0" width="1.5" height="16" fill="#231710" />
            <rect x="12" y="0" width="1" height="16" fill="#231710" />
            <rect x="14" y="0" width="2" height="16" fill="#231710" />
            <rect x="17" y="0" width="1" height="16" fill="#231710" />
            <rect x="18.5" y="0" width="1.5" height="16" fill="#231710" />
          </svg>
          SCANNER
        </Link>
        {cartCount > 0 && !checkoutOpen && (
          <button
            onClick={() => setCheckoutOpen(true)}
            className="flex flex-1 items-center justify-between rounded-2xl bg-[#231710] px-5 py-4 text-white shadow-[0_18px_45px_rgba(35,23,16,.35)]"
          >
            <span className="text-sm font-bold">
              🛒 {cartCount} {tr.cartItems}
            </span>
            <span className="text-base font-black">{formatTL(cartTotal)}</span>
          </button>
        )}
      </div>

      {/* Personel çağır modal */}
      {callOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            {callSent ? (
              <div className="text-center">
                <div className="text-4xl">✅</div>
                <p className="mt-3 font-bold">{tr.callSentText}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-black">{tr.callTitle}</h3>
                  <button
                    onClick={() => setCallOpen(false)}
                    className="rounded-full border border-[#e4d3c1] px-3 py-1.5 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {CALL_TYPES.map((call) => (
                    <button
                      key={call.id}
                      disabled={callSending}
                      onClick={() => sendStaffCall(call.id)}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-[#e5d4c2] bg-[#fffaf4] p-4 text-sm font-bold transition hover:border-[#ef2b1e] disabled:opacity-50"
                    >
                      <span className="text-2xl">{call.emoji}</span>
                      {lang === "tr" ? call.tr : call.id_}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sepet / checkout modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto my-6 max-w-2xl rounded-3xl bg-[#fffaf4] p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a16f52]">
                  {tr.tableLabel} {tableNumber}
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#231710]">
                  {orderComplete ? tr.orderReceived : tr.checkout}
                </h2>
              </div>
              <button
                onClick={() => {
                  setCheckoutOpen(false);
                  if (orderComplete) setOrderComplete(false);
                }}
                className="rounded-full border border-[#e4d3c1] px-3 py-2 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {orderComplete ? (
              <div className="space-y-5 text-center">
                <div className="text-5xl">🍽️</div>
                <div className="text-sm text-[#806b5b]">{tr.orderNo}</div>
                <div className="text-xl font-black">{orderNumber}</div>
                <p className="text-sm leading-6 text-[#6f5a4b]">{tr.orderReceivedText}</p>
                <button
                  onClick={() => {
                    setCheckoutOpen(false);
                    setOrderComplete(false);
                  }}
                  className="w-full rounded-2xl bg-[#ef2b1e] px-5 py-4 text-sm font-black text-white"
                >
                  {tr.close}
                </button>
              </div>
            ) : (
              <form onSubmit={submitOrder} className="space-y-5">
                {cart.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#d8c5b2] bg-white/60 p-6 text-center text-sm font-bold text-[#806b5b]">
                    {tr.emptyCart}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((line) => {
                      const categoryName = categoryNameForProduct(line.product);
                      const showPilavOption = categoryAllowsExtraPilav(categoryName);
                      const showNoodleOption = categoryAllowsExtraNoodle(categoryName);
                      const showSambalOption = !categoryIsBeverage(categoryName);
                      const showNoodleTypeChoice = categoryAllowsNoodleTypeChoice(categoryName);
                      return (
                        <div
                          key={line.product.id}
                          className="rounded-2xl border border-[#e5d4c2] bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-black">{productName(line.product)}</div>
                              <div className="text-sm text-[#806b5b]">
                                {formatTL(lineUnitPrice(line))} × {line.quantity}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => changeQuantity(line.product.id, -1)}
                                className="h-9 w-9 rounded-full border border-[#e5d4c2] font-black"
                              >
                                −
                              </button>
                              <span className="w-6 text-center font-black">{line.quantity}</span>
                              <button
                                type="button"
                                onClick={() => changeQuantity(line.product.id, 1)}
                                className="h-9 w-9 rounded-full border border-[#e5d4c2] font-black"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="mt-2 space-y-1.5">
                            {showSambalOption && (
                              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                                <input
                                  type="checkbox"
                                  checked={line.sambal}
                                  onChange={(event) =>
                                    updateCartLine(line.product.id, { sambal: event.target.checked })
                                  }
                                  className="h-4 w-4 accent-[#ef2b1e]"
                                />
                                🌶️ {tr.wantSambal}
                              </label>
                            )}
                            {showPilavOption && (
                              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                                <input
                                  type="checkbox"
                                  checked={line.extraPilav}
                                  onChange={(event) =>
                                    updateCartLine(line.product.id, {
                                      extraPilav: event.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-[#ef2b1e]"
                                />
                                🍚 {tr.extraPilav}
                              </label>
                            )}
                            {showNoodleOption && (
                              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                                <input
                                  type="checkbox"
                                  checked={line.extraNoodle}
                                  onChange={(event) =>
                                    updateCartLine(line.product.id, {
                                      extraNoodle: event.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-[#ef2b1e]"
                                />
                                🍜 {tr.extraNoodle}
                              </label>
                            )}
                            {showNoodleTypeChoice && (
                              <div className="rounded-xl bg-[#faf5ee] p-2">
                                <p className="mb-1 text-[11px] font-black text-[#806b5b]">
                                  {tr.noodleTypeLabel}
                                </p>
                                {(["noodle150", "mix", "bihun150"] as const).map((option) => (
                                  <label
                                    key={option}
                                    className="flex cursor-pointer items-center gap-2 py-0.5 text-xs font-bold"
                                  >
                                    <input
                                      type="radio"
                                      name={`noodleType-${line.product.id}`}
                                      checked={line.noodleType === option}
                                      onChange={() =>
                                        updateCartLine(line.product.id, { noodleType: option })
                                      }
                                      className="h-4 w-4 accent-[#ef2b1e]"
                                    />
                                    {OPTION_LABELS[option][lang]}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={tr.note}
                  rows={2}
                  className="w-full rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
                />

                <div className="rounded-2xl border border-[#e5d4c2] bg-white p-4">
                  <div className="text-xs font-black uppercase tracking-wide text-[#806b5b]">
                    {tr.totalTL}
                  </div>
                  <div className="mt-1 text-2xl font-black">{formatTL(cartTotal)}</div>
                </div>

                <button
                  type="submit"
                  disabled={cart.length === 0 || submitting}
                  className="w-full rounded-2xl bg-[#ef2b1e] px-5 py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#d92318] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? tr.submitting : tr.finish}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function TableMenuPage() {
  return (
    <Suspense fallback={null}>
      <TableMenu />
    </Suspense>
  );
}
