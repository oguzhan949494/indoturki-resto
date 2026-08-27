 "use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

type Category =
  | "Tümü"
  | "Bowls Ayam"
  | "Bowls"
  | "Bowls Seafood"
  | "Noodle Ayam"
  | "Noodles"
  | "Seafood Noodles"
  | "Mie Ayam & Bakso"
  | "Snacks"
  | "Coffee & Tea"
  | "Mixed Drinks"
  | "Soft Drinks";

type Product = {
  id: string;
  name: string;
  nameTr: string;
  nameId: string;
  category: Exclude<Category, "Tümü">;
  price: number;
  description: string;
  spicy?: number;
  new?: boolean;
};

type CartLine = {
  product: Product;
  quantity: number;
};



const categoryLabels: { id: Category; label: string; emoji: string }[] = [
  { id: "Tümü", label: "Tümü", emoji: "✨" },
  { id: "Bowls Ayam", label: "Bowls Ayam", emoji: "🍚" },
  { id: "Bowls", label: "Bowls", emoji: "🥩" },
  { id: "Bowls Seafood", label: "Seafood Bowls", emoji: "🦐" },
  { id: "Noodle Ayam", label: "Noodle Ayam", emoji: "🍜" },
  { id: "Noodles", label: "Noodles", emoji: "🍜" },
  { id: "Seafood Noodles", label: "Seafood Noodles", emoji: "🦐" },
  { id: "Mie Ayam & Bakso", label: "Mie Ayam & Bakso", emoji: "🍲" },
  { id: "Snacks", label: "Snacks", emoji: "🍢" },
  { id: "Coffee & Tea", label: "Coffee & Tea", emoji: "☕" },
  { id: "Mixed Drinks", label: "Mixed Drinks", emoji: "🥤" },
  { id: "Soft Drinks", label: "Soft Drinks", emoji: "🧊" },
];

const formatTL = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);

function Spice({ count }: { count?: number }) {
  if (!count) return null;

  const categoryLabel = (category: Category) => {
    if (lang === "tr") {
      return categoryLabels.find((item) => item.id === category)?.label ?? category;
    }
    const map: Record<Category, string> = {
      "Tümü": "Semua",
      "Bowls Ayam": "Rice Bowl Ayam",
      "Bowls": "Rice Bowl",
      "Bowls Seafood": "Rice Bowl Seafood",
      "Noodle Ayam": "Noodle Ayam",
      "Noodles": "Noodles",
      "Seafood Noodles": "Noodle Seafood",
      "Mie Ayam & Bakso": "Mie Ayam & Bakso",
      "Snacks": "Camilan",
      "Coffee & Tea": "Kopi & Teh",
      "Mixed Drinks": "Minuman Campur",
      "Soft Drinks": "Minuman Ringan",
    };
    return map[category];
  };

  return (
    <span className="ml-1 text-[11px]" title={`Acılık: ${count}/5`}>
      {"🌶️".repeat(Math.min(count, 5))}
    </span>
  );
}

function FoodVisual({ product }: { product: Product }) {
  const isDrink =
    product.category === "Coffee & Tea" ||
    product.category === "Mixed Drinks" ||
    product.category === "Soft Drinks";

  const symbol =
    product.category.includes("Noodle") || product.category === "Noodles"
      ? "🍜"
      : product.category === "Snacks"
        ? "🍢"
        : isDrink
          ? "🥤"
          : product.category.includes("Seafood")
            ? "🦐"
            : "🍚";

  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-[#f9e8d5] via-[#fff7eb] to-[#e7c5aa]">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#d9472f]/10" />
      <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-[#9b5c38]/10" />
      <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white/70 text-7xl shadow-[0_14px_30px_rgba(82,42,24,.18)]">
        {symbol}
      </div>
      {product.new && (
        <span className="absolute left-3 top-3 rounded-full bg-[#ef2b1e] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
          Yeni
        </span>
      )}
      {product.spicy && (
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs shadow-sm">
          <Spice count={product.spicy} />
        </span>
      )}
    </div>
  );
}

export default function Home() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
  async function loadProducts() {
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("is_available", true)
      .order("sort_order", { ascending: true });

    if (productError) {
      console.error("Ürünler alınamadı:", productError);
      return;
    }

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id, name_tr, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (categoryError) {
      console.error("Kategoriler alınamadı:", categoryError);
      return;
    }

    const categoryMap = new Map(
      (categoryData ?? []).map((category) => [
        category.id,
        category.name_tr,
      ])
    );

    const mappedProducts: Product[] = (productData ?? []).map((product) => ({
      id: product.id,
      name: product.name_tr,
      nameTr: product.name_tr,
      nameId: product.name_id,
      category: categoryMap.get(product.category_id) as Exclude<Category, "Tümü">,
      price: Number(product.price_tl),
      description: product.description_tr ?? "",
      imageUrl: product.image_url ?? undefined,
      new: product.is_new ?? false,
    }));

    setProducts(mappedProducts);
    const { data: settingsData, error: settingsError } = await supabase
  .from("restaurant_settings")
  .select("idr_rate")
  .limit(1)
  .single();

if (!settingsError && settingsData?.idr_rate) {
  setIdrRate(Number(settingsData.idr_rate));
}
    console.log("SUPABASE ÜRÜNLERİ:", mappedProducts);
  }

  loadProducts();
}, []);
  const [activeCategory, setActiveCategory] = useState<Category>("Tümü");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sambal, setSambal] = useState(true);
  const [lang, setLang] = useState<"tr" | "id">("tr");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [idrRate, setIdrRate] = useState(500);
  const tr = {
    menuSearch: lang === "tr" ? "Menüde ara..." : "Cari di menu...",
    cart: lang === "tr" ? "Sepet" : "Keranjang",
    menu: lang === "tr" ? "Menü" : "Menu",
    popular: lang === "tr" ? "Popüler ve sevilenler" : "Pilihan populer",
    products: lang === "tr" ? "ürün" : "produk",
    add: lang === "tr" ? "Sepete Ekle" : "Tambah ke keranjang",
    sambalInfo:
      lang === "tr"
        ? "Paket siparişlerinde ücretsiz verilir. İstemiyorsanız sipariş sırasında kaldırabilirsiniz."
        : "Gratis untuk pesanan takeaway. Jika tidak ingin, Anda dapat menghapusnya saat memesan.",
    wantSambal: lang === "tr" ? "Sambal sos istiyorum" : "Saya ingin sambal",
    tableTitle: lang === "tr" ? "Masa müşterilerimize" : "Untuk pelanggan di meja",
    tableInfo:
      lang === "tr"
        ? "QR siparişlerinde siparişinizi tamamladıktan sonra extra sos alanımızdaki sosları ücretsiz kullanabilirsiniz."
        : "Untuk pesanan QR di meja, setelah menyelesaikan pesanan Anda dapat mengambil saus gratis dari area extra saus kami.",
    traditional:
      lang === "tr" ? "GELENEKSEL ENDONEZYA YEMEKLERİ" : "HIDANGAN TRADISIONAL INDONESIA",
    heroTitle:
      lang === "tr" ? "Endonezya mutfağının" : "Cita rasa asli masakan",
    heroAccent: lang === "tr" ? "gerçek lezzetleri." : "Indonesia.",
    heroText:
      lang === "tr"
        ? "Dilediğin yemeği seç, sepete ekle ve siparişini birkaç dokunuşla tamamla."
        : "Pilih makanan favorit Anda, tambahkan ke keranjang dan selesaikan pesanan dengan beberapa sentuhan.",
    indonesianCuisine: lang === "tr" ? "Endonezya Mutfağı" : "Masakan Indonesia",
    spices: lang === "tr" ? "Gerçek Baharatlar" : "Rempah Asli",
    takeaway: lang === "tr" ? "Paket Servis" : "Takeaway",
    noProduct: lang === "tr" ? "Ürün bulunamadı." : "Produk tidak ditemukan.",
    showMenu: lang === "tr" ? "Menüyü göster" : "Tampilkan menu",
    traditionalDishes:
      lang === "tr" ? "Geleneksel Endonezya Yemekleri" : "Hidangan Tradisional Indonesia",
    paymentInfo:
      lang === "tr"
        ? "Paket siparişleri havale / EFT ile ödenebilir."
        : "Pesanan takeaway dapat dibayar melalui transfer bank.",
    sambalTitle: lang === "tr" ? "Ücretsiz Sambal Sos" : "Sambal Gratis",
    cartItems: lang === "tr" ? "ürün" : "produk",
    goCart: lang === "tr" ? "Sepete Git →" : "Lihat Keranjang →",
    checkout: lang === "tr" ? "Siparişi Tamamla" : "Selesaikan Pesanan",
    yourCart: lang === "tr" ? "Sepetiniz" : "Keranjang Anda",
    emptyCart: lang === "tr" ? "Sepetiniz boş." : "Keranjang Anda kosong.",
    quantity: lang === "tr" ? "Adet" : "Jumlah",
    totalTL: lang === "tr" ? "TL Toplamı" : "Total TL",
    totalIDR: lang === "tr" ? "IDR Toplamı" : "Total IDR",
    customerInfo: lang === "tr" ? "Teslimat Bilgileri" : "Informasi Pengiriman",
    name: lang === "tr" ? "Alıcı adı soyadı" : "Nama penerima",
    phone: lang === "tr" ? "Telefon numarası" : "Nomor telepon",
    address: lang === "tr" ? "Teslimat adresi" : "Alamat pengiriman",
    date: lang === "tr" ? "Teslimat tarihi" : "Tanggal pengiriman",
    time: lang === "tr" ? "Teslimat saati" : "Waktu pengiriman",
    continue: lang === "tr" ? "Devam Et" : "Lanjutkan",
    back: lang === "tr" ? "Geri" : "Kembali",
    paymentTitle: lang === "tr" ? "Ödeme Bilgileri" : "Informasi Pembayaran",
    paymentNote:
      lang === "tr"
        ? "Siparişiniz bize iletildi. Lütfen uygun hesabımıza havale/EFT yapın. Ödeme hesabımıza ulaştığında siparişiniz hazırlanacaktır."
        : "Pesanan Anda telah diterima. Silakan lakukan transfer ke rekening yang sesuai. Pesanan akan diproses setelah pembayaran diterima.",
    turkeyAccount: lang === "tr" ? "🇹🇷 TL hesabımız" : "🇹🇷 Rekening TL kami",
    indonesiaAccount: lang === "tr" ? "🇮🇩 IDR hesabımız" : "🇮🇩 Rekening IDR kami",
    accountPlaceholder:
      lang === "tr"
        ? "Banka / Hesap Sahibi / IBAN bilgisi burada gösterilecek."
        : "Informasi bank / nama pemilik / nomor rekening akan ditampilkan di sini.",
    finish: lang === "tr" ? "Siparişi Gönder" : "Kirim Pesanan",
    orderReceived: lang === "tr" ? "Siparişiniz alındı!" : "Pesanan Anda telah diterima!",
    orderNo: lang === "tr" ? "Sipariş No" : "Nomor Pesanan",
    paymentWaiting: lang === "tr" ? "Ödeme bekleniyor" : "Menunggu pembayaran",
    paymentWaitingText:
      lang === "tr"
        ? "Lütfen yukarıdaki hesaplardan uygun olanına ödemenizi gerçekleştirin."
        : "Silakan lakukan pembayaran ke rekening yang sesuai di atas.",
    close: lang === "tr" ? "Kapat" : "Tutup",
    remove: lang === "tr" ? "Sil" : "Hapus",
    increase: lang === "tr" ? "Artır" : "Tambah",
    decrease: lang === "tr" ? "Azalt" : "Kurangi",
  };

  const categoryLabel = (category: Category) => {
    if (lang === "tr") {
      return categoryLabels.find((item) => item.id === category)?.label ?? category;
    }
    const map: Record<Category, string> = {
      "Tümü": "Semua",
      "Bowls Ayam": "Rice Bowl Ayam",
      "Bowls": "Rice Bowl",
      "Bowls Seafood": "Rice Bowl Seafood",
      "Noodle Ayam": "Noodle Ayam",
      "Noodles": "Noodles",
      "Seafood Noodles": "Noodle Seafood",
      "Mie Ayam & Bakso": "Mie Ayam & Bakso",
      "Snacks": "Camilan",
      "Coffee & Tea": "Kopi & Teh",
      "Mixed Drinks": "Minuman Campur",
      "Soft Drinks": "Minuman Ringan",
    };
    return map[category];
  };

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return products.filter((product) => {
      const categoryMatch =
        activeCategory === "Tümü" || product.category === activeCategory;
      const searchMatch =
        !q ||
        product.name.toLocaleLowerCase("tr-TR").includes(q) ||
        product.description.toLocaleLowerCase("tr-TR").includes(q);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, search]);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );

  // Geçici demo kuru. Gerçek kur ve banka hesapları yönetim panelinden ayarlanacak.
const cartTotalIDR = cartTotal * idrRate;

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  try {
    // 6 haneli sayısal sipariş numarası
    const numericOrderNumber = Math.floor(
      100000 + Math.random() * 900000
    );

    // Ekranda ID-306065 şeklinde göstereceğiz
    const displayOrderNumber = `ID-${numericOrderNumber}`;

    // 1. ORDERS kaydı
    const orderId = crypto.randomUUID();
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        source: "delivery",
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress || null,
        delivery_date: deliveryDate || null,
        delivery_time: deliveryTime || null,
        total_tl: cartTotal,
        total_idr: cartTotalIDR,
        sambal_requested: sambal,
        payment_status: "pending",
        order_status: "new",
      })

    if (orderError) {
      console.error("ORDER KAYIT HATASI:", orderError);
      alert("Sipariş kaydedilemedi. Lütfen tekrar deneyin.");
      return;
    }

    // 2. ORDER_ITEMS kayıtları
    const orderItems = cart.map((line) => ({
      order_id: orderId,
      product_id: line.product.id,
      product_name_tr: line.product.nameTr,
      product_name_id: line.product.nameId,
      quantity: line.quantity,
      unit_price_tl: line.product.price,
      unit_price_idr: line.product.price * idrRate,
      options: [],
      item_note: null,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("ORDER ITEMS KAYIT HATASI:", itemsError);
      alert("Sipariş ürünleri kaydedilemedi. Lütfen tekrar deneyin.");
      return;
    }

    // 3. Sipariş başarıyla tamamlandı
    setOrderNumber(displayOrderNumber);
    setOrderComplete(true);

  } catch (error) {
    console.error("SİPARİŞ HATASI:", error);
    alert("Beklenmeyen bir hata oluştu.");
  }
};

  return (
    <main className="min-h-screen bg-[#f7eee3] text-[#231710]">
      <header className="sticky top-0 z-30 border-b border-[#e8d8c7] bg-[#fffaf4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ef2b1e] text-xl shadow-sm">
              🇮🇩
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-[#ef2b1e]">
                INDOTURKI
              </div>
              <div className="-mt-1 text-[9px] font-bold uppercase tracking-[0.35em] text-[#4d2d20]">
                Resto
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-[#e4d3c1] bg-white p-1 text-[11px] font-black">
              <button
                onClick={() => setLang("tr")}
                className={`rounded-full px-2.5 py-1.5 transition ${lang === "tr" ? "bg-[#ef2b1e] text-white" : "text-[#6d5547]"}`}
              >
                🇹🇷 TR
              </button>
              <button
                onClick={() => setLang("id")}
                className={`rounded-full px-2.5 py-1.5 transition ${lang === "id" ? "bg-[#ef2b1e] text-white" : "text-[#6d5547]"}`}
              >
                🇮🇩 ID
              </button>
            </div>
            <button
              onClick={() => setCheckoutOpen(true)}
              className="relative rounded-full bg-[#231710] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#3a251b]"
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
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              ⌕
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr.menuSearch}
              className="w-full rounded-2xl border border-[#e4d3c1] bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#a18b7b] focus:border-[#ef2b1e] focus:ring-2 focus:ring-[#ef2b1e]/10"
            />
          </div>
        </div>

        <div className="overflow-x-auto border-t border-[#eee1d4] bg-[#fffaf4]">
          <div className="mx-auto flex max-w-6xl gap-2 px-4 py-2.5 sm:px-6">
            {categoryLabels.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
                  activeCategory === category.id
                    ? "bg-[#ef2b1e] text-white shadow-sm"
                    : "border border-[#e5d6c7] bg-white text-[#5b4032] hover:border-[#ef2b1e]/40"
                }`}
              >
                <span>{category.emoji}</span>
                {categoryLabel(category.id)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6">
        <div className="relative overflow-hidden rounded-[30px] bg-[#231710] p-6 text-white shadow-[0_18px_50px_rgba(64,34,18,.18)] sm:p-10">
          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-[#ef2b1e]/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#f1a34a]/20 blur-3xl" />
          <div className="relative max-w-xl">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.3em] text-[#f7c892]">
              {tr.traditionalDishes}
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              {tr.heroTitle}
              <span className="block text-[#ef3b2d]">{tr.heroAccent}</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base">
              Dilediğin yemeği seç, sepetine ekle ve siparişini birkaç dokunuşla tamamla.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/10 px-4 py-2">🇮🇩 {tr.indonesianCuisine}</span>
              <span className="rounded-full bg-white/10 px-4 py-2">🌶️ {tr.spices}</span>
              <span className="rounded-full bg-white/10 px-4 py-2">🚚 {tr.takeaway}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e8d7c5] bg-[#fffaf3] p-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🌶️</div>
              <div>
                <div className="text-sm font-black">{tr.sambalTitle}</div>
                <p className="mt-1 text-xs leading-5 text-[#745d4e]">
                  {tr.sambalInfo}
                </p>
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

          <div className="rounded-2xl border border-[#e8d7c5] bg-[#fffaf3] p-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🧴</div>
              <div>
                <div className="text-sm font-black">{tr.tableTitle}</div>
                <p className="mt-1 text-xs leading-5 text-[#745d4e]">
                  {tr.tableInfo}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#a16f52]">
              {tr.menu}
            </p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">
              {activeCategory === "Tümü" ? tr.popular : categoryLabel(activeCategory)}
            </h2>
          </div>
          <div className="text-xs font-semibold text-[#8b7566]">
            {visibleProducts.length} {tr.products}
          </div>
        </div>

        {visibleProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d8c5b2] bg-white/60 p-12 text-center">
            <div className="text-4xl">🔎</div>
            <p className="mt-3 font-bold">{tr.noProduct}</p>
            <button
              onClick={() => {
                setSearch("");
                setActiveCategory("Tümü");
              }}
              className="mt-4 rounded-full bg-[#231710] px-5 py-2 text-xs font-bold text-white"
            >
              {tr.showMenu}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-[26px] border border-[#e6d5c4] bg-[#fffaf5] shadow-[0_8px_30px_rgba(84,47,27,.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(84,47,27,.12)]"
              >
                <FoodVisual product={product} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black leading-tight">
                        {product.name}
                        <Spice count={product.spicy} />
                      </h3>
                      <p className="mt-2 min-h-10 text-xs leading-5 text-[#806b5b]">
                        {product.description}
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
                    <span className="text-lg">+</span>
                    {tr.add}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {cartCount > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-24px)] max-w-lg -translate-x-1/2">
          <button
            onClick={() => setCheckoutOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-[#231710] px-5 py-4 text-white shadow-[0_18px_45px_rgba(35,23,16,.35)]"
          >
            <span className="text-sm font-bold">
              🛒 {cartCount} {tr.cartItems}
            </span>
            <span className="text-base font-black">{formatTL(cartTotal)}</span>
            <span className="rounded-xl bg-[#ef2b1e] px-4 py-2 text-xs font-black">
              {tr.goCart}
            </span>
          </button>
        </div>
      )}

      <footer className="border-t border-[#e5d5c4] bg-[#fffaf4]">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center sm:px-6">
          <div className="text-lg font-black text-[#ef2b1e]">INDOTURKI RESTO</div>
          <p className="mt-2 text-xs text-[#806b5b]">
            {tr.traditionalDishes}
          </p>
          <p className="mt-4 text-xs text-[#a18b7b]">
            {tr.paymentInfo}
          </p>
        </div>
      </footer>
    
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto my-6 max-w-2xl rounded-3xl bg-[#fffaf4] p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a16f52]">
                  {orderComplete ? tr.paymentTitle : tr.yourCart}
                </p>
                <h2 className="mt-1 text-2xl font-black text-[#231710]">
                  {orderComplete ? tr.orderReceived : tr.checkout}
                </h2>
              </div>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="rounded-full border border-[#e4d3c1] px-3 py-2 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {orderComplete ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#e5d4c2] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-[#806b5b]">{tr.orderNo}</div>
                      <div className="text-xl font-black">{orderNumber}</div>
                    </div>
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                      🟠 {tr.paymentWaiting}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#6f5a4b]">{tr.paymentNote}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#e5d4c2] bg-white p-5">
                    <div className="text-sm font-black">{tr.totalTL}</div>
                    <div className="mt-1 text-2xl font-black text-[#ef2b1e]">
                      {formatTL(cartTotal)}
                    </div>
                    <div className="mt-4 text-sm font-black">{tr.turkeyAccount}</div>
                    <div className="mt-2 rounded-xl bg-[#f8efe6] p-3 text-sm leading-7 text-[#6f5a4b]">
                      <div><span className="font-bold">{lang === "tr" ? "Hesap sahibi" : "Nama pemilik"}:</span> NURAINI NURAINI</div>
                      <div className="mt-1 break-all"><span className="font-bold">IBAN:</span> TR36 0001 0090 1018 2182 3050 01</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#e5d4c2] bg-white p-5">
                    <div className="text-sm font-black">{tr.totalIDR}</div>
                    <div className="mt-1 text-2xl font-black text-[#ef2b1e]">
                      Rp {cartTotalIDR.toLocaleString("id-ID")}
                    </div>
                    <div className="mt-4 text-sm font-black">{tr.indonesiaAccount}</div>
                    <div className="mt-2 rounded-xl bg-[#f8efe6] p-3 text-sm leading-7 text-[#6f5a4b]">
                      <div><span className="font-bold">Bank:</span> BNI</div>
                      <div className="mt-1"><span className="font-bold">{lang === "tr" ? "Hesap sahibi" : "Nama pemilik"}:</span> SDRI. NURAINI</div>
                      <div className="mt-1"><span className="font-bold">{lang === "tr" ? "Hesap No" : "Nomor rekening"}:</span> 0710603875</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#231710] p-4 text-sm leading-6 text-white">
                  {tr.paymentWaitingText}
                </div>

                <button
                  onClick={() => setCheckoutOpen(false)}
                  className="w-full rounded-2xl bg-[#ef2b1e] px-5 py-4 text-sm font-black text-white"
                >
                  {tr.close}
                </button>
              </div>
            ) : (
              <form onSubmit={submitOrder} className="space-y-5">
                <div className="space-y-3">
                  {cart.map((line) => (
                    <div
                      key={line.product.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#e5d4c2] bg-white p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-black">{line.product.name}</div>
                        <div className="text-sm text-[#806b5b]">
                          {formatTL(line.product.price)} × {line.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeQuantity(line.product.id, -1)}
                          aria-label={tr.decrease}
                          className="h-9 w-9 rounded-full border border-[#e5d4c2] font-black"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-black">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(line.product.id, 1)}
                          aria-label={tr.increase}
                          className="h-9 w-9 rounded-full border border-[#e5d4c2] font-black"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl bg-[#f8efe6] p-4">
                  <label className="flex items-center gap-3 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={sambal}
                      onChange={(event) => setSambal(event.target.checked)}
                      className="h-5 w-5 accent-[#ef2b1e]"
                    />
                    🌶️ {tr.wantSambal}
                  </label>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-black">{tr.customerInfo}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder={tr.name}
                      className="rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
                    />
                    <input
                      required
                      type="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder={tr.phone}
                      className="rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
                    />
                    <textarea
                      required
                      value={deliveryAddress}
                      onChange={(event) => setDeliveryAddress(event.target.value)}
                      placeholder={tr.address}
                      rows={3}
                      className="sm:col-span-2 rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
                    />
                    <input
                      required
                      type="date"
                      value={deliveryDate}
                      onChange={(event) => setDeliveryDate(event.target.value)}
                      className="rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
                      aria-label={tr.date}
                    />
                    <input
                      required
                      type="time"
                      value={deliveryTime}
                      onChange={(event) => setDeliveryTime(event.target.value)}
                      className="rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
                      aria-label={tr.time}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs font-bold text-[#806b5b]">
                    <span>{tr.date}</span>
                    <span>{tr.time}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#e5d4c2] bg-white p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-[#806b5b]">{tr.totalTL}</div>
                    <div className="mt-1 text-2xl font-black">{formatTL(cartTotal)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e5d4c2] bg-white p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-[#806b5b]">{tr.totalIDR}</div>
                    <div className="mt-1 text-2xl font-black">Rp {cartTotalIDR.toLocaleString("id-ID")}</div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-[#ef2b1e] px-5 py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#d92318]"
                >
                  {tr.finish}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
</main>
  );
}