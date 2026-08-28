"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ALL_CATEGORY_ID,
  formatTL,
  mapCategories,
  mapProducts,
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

  const [lang, setLang] = useState<"tr" | "id">("tr");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableError, setTableError] = useState(false);

  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY_ID);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sambal, setSambal] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [note, setNote] = useState("");

  const [callOpen, setCallOpen] = useState(false);
  const [callSending, setCallSending] = useState(false);
  const [callSent, setCallSent] = useState<string | null>(null);

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
        }
      } else {
        setTableError(true);
      }

      const { data: categoryData } = await supabase
        .from("categories")
        .select("id, name_tr, name_id, emoji, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("is_available", true)
        .order("sort_order", { ascending: true });

      setCategories(mapCategories(categoryData));
      setProducts(mapProducts(productData));
      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNumber]);

  const tr = {
    menuSearch: lang === "tr" ? "Menüde ara..." : "Cari di menu...",
    cart: lang === "tr" ? "Sepet" : "Keranjang",
    tableLabel: lang === "tr" ? "Masa" : "Meja",
    add: lang === "tr" ? "Sepete Ekle" : "Tambah ke keranjang",
    wantSambal: lang === "tr" ? "Sambal sos istiyorum" : "Saya ingin sambal",
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
    return products.filter((product) => {
      const categoryMatch =
        activeCategory === ALL_CATEGORY_ID || product.categoryId === activeCategory;
      const name = productName(product).toLocaleLowerCase("tr-TR");
      const searchMatch = !q || name.includes(q);
      return categoryMatch && searchMatch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, search, products, lang]);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { product, quantity: 1, note: "" }];
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
  };

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

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
          total_tl: cartTotal,
          total_idr: 0,
          sambal_requested: sambal,
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
        unit_price_tl: line.product.price,
        unit_price_idr: 0,
        options: [],
        item_note: null,
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
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={sambal}
              onChange={(event) => setSambal(event.target.checked)}
              className="h-4 w-4 accent-[#ef2b1e]"
            />
            {tr.wantSambal}
          </label>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black leading-tight">
                      {productName(product)}
                      <Spice count={product.spicy} />
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-[#806b5b]">
                      {productDescription(product)}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full border border-[#d9c2ae] bg-white px-3 py-1.5 text-sm font-black">
                    {formatTL(product.price)}
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

      {/* Sabit alt bar: sepet özeti + personel çağır */}
      <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-24px)] max-w-lg -translate-x-1/2 gap-2">
        <button
          onClick={() => setCallOpen(true)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-[#231710] shadow-[0_18px_45px_rgba(35,23,16,.25)] border border-[#e5d4c2]"
        >
          🔔 {tr.callStaff}
        </button>
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
                    {cart.map((line) => (
                      <div
                        key={line.product.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#e5d4c2] bg-white p-3"
                      >
                        <div className="min-w-0">
                          <div className="font-black">{productName(line.product)}</div>
                          <div className="text-sm text-[#806b5b]">
                            {formatTL(line.product.price)} × {line.quantity}
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
                    ))}
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
