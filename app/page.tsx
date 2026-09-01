"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Script from "next/script";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { isRestaurantOpen, type RestaurantHoursSettings } from "@/utils/restaurant-hours";
import AddressPicker from "@/components/AddressPicker";
import {
  ALL_CATEGORY_ID,
  categoryAllowsExtraNoodle,
  categoryIsBeverage,
  categoryAllowsNoodleTypeChoice,
  categoryAllowsExtraPilav,
  formatIDR,
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

function ProductVisual({ product }: { product: Product }) {
  return (
    <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-[#f9e8d5] via-[#fff7eb] to-[#e7c5aa]">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.nameTr}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#d9472f]/10" />
          <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-[#9b5c38]/10" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/70 text-6xl shadow-[0_14px_30px_rgba(82,42,24,.18)]">
            🍽️
          </div>
        </>
      )}
      {product.isNew && (
        <span className="absolute left-3 top-3 rounded-full bg-[#ef2b1e] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
          Yeni
        </span>
      )}
      {product.spicy > 0 && (
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs shadow-sm">
          <Spice count={product.spicy} />
        </span>
      )}
    </div>
  );
}

export default function Home() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [idrRate, setIdrRate] = useState(500);
  const [bankInfo, setBankInfo] = useState({
    tlAccountName: "",
    tlIban: "",
    idrBank: "",
    idrAccountName: "",
    idrAccountNumber: "",
  });
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY_ID);
  const [menuSection, setMenuSection] = useState<"menu" | "market">("menu");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [lang, setLang] = useState<"tr" | "id">("id");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [addressNote, setAddressNote] = useState("");
  const [leaveAtReception, setLeaveAtReception] = useState(false);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [courierFee, setCourierFee] = useState<number | null>(null);
  const [courierDistanceKm, setCourierDistanceKm] = useState<number | null>(null);
  const [courierFeeLoading, setCourierFeeLoading] = useState(false);
  const [courierFeeError, setCourierFeeError] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryTiming, setDeliveryTiming] = useState<"now" | "scheduled">("now");
  const [restaurantOpen, setRestaurantOpen] = useState(true);
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "dinein">("delivery");
  const [orderNumber, setOrderNumber] = useState("");
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [completedTotalTL, setCompletedTotalTL] = useState(0);
  const [completedTotalIDR, setCompletedTotalIDR] = useState(0);
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [paytrToken, setPaytrToken] = useState<string | null>(null);
  const [paytrLoading, setPaytrLoading] = useState(false);
  const [paytrError, setPaytrError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id, name_tr, name_id, emoji, sort_order, section")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (categoryError) {
        console.error("Kategoriler alınamadı:", categoryError);
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("is_available", true)
        .order("sort_order", { ascending: true });

      if (productError) {
        console.error("Ürünler alınamadı:", productError);
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from("restaurant_settings")
        .select(
          "idr_rate, bank_tl_account_name, bank_tl_iban, bank_idr_bank, bank_idr_account_name, bank_idr_account_number, opening_time, closing_time, manual_status"
        )
        .limit(1)
        .maybeSingle();

      if (!settingsError && settingsData) {
        setIdrRate(Number(settingsData.idr_rate) || 500);
        setBankInfo({
          tlAccountName: settingsData.bank_tl_account_name ?? "",
          tlIban: settingsData.bank_tl_iban ?? "",
          idrBank: settingsData.bank_idr_bank ?? "",
          idrAccountName: settingsData.bank_idr_account_name ?? "",
          idrAccountNumber: settingsData.bank_idr_account_number ?? "",
        });
        const open = isRestaurantOpen(settingsData as RestaurantHoursSettings);
        setRestaurantOpen(open);
        if (!open) {
          setDeliveryTiming("scheduled");
        }
      }

      setCategories(mapCategories(categoryData));
      setProducts(mapProducts(productData));
      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tr = {
    menuSearch: lang === "tr" ? "Menüde ara..." : "Cari di menu...",
    cart: lang === "tr" ? "Sepet" : "Keranjang",
    menu: lang === "tr" ? "Menü" : "Menu",
    popular: lang === "tr" ? "Tüm Ürünler" : "Semua Produk",
    productsWord: lang === "tr" ? "ürün" : "produk",
    add: lang === "tr" ? "Sepete Ekle" : "Tambah ke keranjang",
    sambalInfo:
      lang === "tr"
        ? "Ücretsizdir. Sepetteki her ürün için ayrı ayrı seçebilirsiniz."
        : "Gratis. Anda dapat memilihnya secara terpisah untuk setiap produk di keranjang.",
    wantSambal: lang === "tr" ? "Sambal sos istiyorum" : "Saya ingin sambal",
    extraPilav: lang === "tr" ? "Ekstra Pilav (150g) +50₺" : "Tambah Nasi (150g) +50₺",
    extraNoodle: lang === "tr" ? "Ekstra Noodle (75g) +50₺" : "Tambah Mie (75g) +50₺",
    noodleTypeLabel: lang === "tr" ? "Noodle / Bihun Tercihi" : "Pilihan Mie / Bihun",
    traditionalDishes:
      lang === "tr" ? "Geleneksel Endonezya Yemekleri" : "Hidangan Tradisional Indonesia",
    heroTitle: lang === "tr" ? "Endonezya mutfağının" : "Cita rasa asli masakan",
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
    paymentInfo:
      lang === "tr"
        ? "Paket siparişleri havale / EFT ile ödenebilir."
        : "Pesanan takeaway dapat dibayar melalui transfer bank.",
    sambalTitle: lang === "tr" ? "Ücretsiz Sambal Sos" : "Sambal Gratis",
    cartItems: lang === "tr" ? "ürün" : "produk",
    goCart: lang === "tr" ? "Sepete Git →" : "Lihat Keranjang →",
    checkout: lang === "tr" ? "Siparişi Tamamla" : "Selesaikan Pesanan",
    yourCart: lang === "tr" ? "Sepetiniz" : "Keranjang Anda",
    itemNotePlaceholder:
      lang === "tr" ? "Bu ürün için not ekle (opsiyonel)..." : "Tambahkan catatan untuk produk ini (opsional)...",
    customerInfo: lang === "tr" ? "Teslimat Bilgileri" : "Informasi Pengiriman",
    orderTypeLabel: lang === "tr" ? "Sipariş şekli" : "Jenis pesanan",
    orderTypeDelivery: lang === "tr" ? "🚚 Paket Servis" : "🚚 Antar",
    orderTypePickup: lang === "tr" ? "🏃 Gel Al" : "🏃 Ambil Sendiri",
    orderTypeDinein: lang === "tr" ? "🍽️ Restoranda Yiyeceğim" : "🍽️ Makan di Tempat",
    name: lang === "tr" ? "Alıcı adı soyadı" : "Nama penerima",
    phone:
      lang === "tr"
        ? "Telefon numarası (Endonezya numarası da olabilir)"
        : "Nomor telepon (nomor Indonesia juga bisa)",
    phoneHint:
      lang === "tr"
        ? "Daha önce sipariş verdiyseniz bilgileriniz otomatik doldurulur."
        : "Jika Anda pernah memesan sebelumnya, informasi Anda akan terisi otomatis.",
    addressNotePlaceholder:
      lang === "tr"
        ? "Daire no, işletme adı (otel/spa vb.) gibi detayları buraya yazabilirsiniz..."
        : "Anda dapat menuliskan nomor apartemen, nama tempat (hotel/spa dll.) di sini...",
    leaveAtReception:
      lang === "tr" ? "Resepsiyona bırakabilirsiniz" : "Dapat dititipkan di resepsionis",
    address: lang === "tr" ? "Teslimat adresi" : "Alamat pengiriman",
    addressSelectInstruction:
      lang === "tr"
        ? "⚠️ Devam edebilmek için, aşağıda çıkan önerilerden adresinizi seçin. Açık adresinizi (bina/daire no vb.) aşağıdaki not alanına yazabilirsiniz."
        : "⚠️ Untuk melanjutkan, pilih alamat Anda dari saran yang muncul di bawah. Anda dapat menuliskan alamat lengkap (nomor bangunan/apartemen dll.) di kolom catatan di bawah.",
    dragHint:
      lang === "tr"
        ? "İşaretçiyi (pin) sürükleyerek tam konumunuzu ayarlayabilirsiniz."
        : "Anda dapat menyeret pin untuk mengatur lokasi tepat Anda.",
    courierCalculating: lang === "tr" ? "Kurye ücreti hesaplanıyor..." : "Menghitung ongkos kirim...",
    courierFeeLabel: lang === "tr" ? "Kurye ücreti" : "Ongkos kirim",
    subtotalLabel: lang === "tr" ? "Ürünler" : "Produk",
    date: lang === "tr" ? "Teslimat tarihi" : "Tanggal pengiriman",
    time: lang === "tr" ? "Teslimat saati" : "Waktu pengiriman",
    deliveryTimingLabel:
      orderType === "delivery"
        ? lang === "tr" ? "Ne zaman teslim edelim?" : "Kapan ingin dikirim?"
        : orderType === "pickup"
          ? lang === "tr" ? "Ne zaman gelip alacaksınız?" : "Kapan Anda akan mengambil?"
          : lang === "tr" ? "Ne zaman geleceksiniz?" : "Kapan Anda akan datang?",
    deliveryNow: lang === "tr" ? "Şimdi" : "Sekarang",
    deliveryScheduled: lang === "tr" ? "İleri tarih seç" : "Pilih tanggal lain",
    payWithCard: lang === "tr" ? "Kart ile Güvenli Öde" : "Bayar dengan Kartu",
    cardLoading: lang === "tr" ? "Ödeme formu yükleniyor..." : "Memuat formulir pembayaran...",
    cardErrorRetry: lang === "tr" ? "Tekrar dene" : "Coba lagi",
    preferBankTransfer:
      lang === "tr" ? "🏦 Banka havalesi ile ödemek istiyorum" : "🏦 Saya ingin bayar via transfer bank",
    hideBankTransfer: lang === "tr" ? "Kart ile ödemeye dön" : "Kembali ke pembayaran kartu",
    paymentTitle: lang === "tr" ? "Ödeme Bilgileri" : "Informasi Pembayaran",
    paymentNote:
      lang === "tr"
        ? "Siparişiniz bize iletildi. Lütfen uygun hesabımıza havale/EFT yapın. Ödeme hesabımıza ulaştığında siparişiniz hazırlanacaktır."
        : "Pesanan Anda telah diterima. Silakan lakukan transfer ke rekening yang sesuai. Pesanan akan diproses setelah pembayaran diterima.",
    turkeyAccount: lang === "tr" ? "🇹🇷 TL hesabımız" : "🇹🇷 Rekening TL kami",
    indonesiaAccount: lang === "tr" ? "🇮🇩 IDR hesabımız" : "🇮🇩 Rekening IDR kami",
    finish: lang === "tr" ? "Siparişi Gönder" : "Kirim Pesanan",
    submitting: lang === "tr" ? "Gönderiliyor..." : "Mengirim...",
    orderReceived: lang === "tr" ? "Siparişiniz alındı!" : "Pesanan Anda telah diterima!",
    orderNo: lang === "tr" ? "Sipariş No" : "Nomor Pesanan",
    paymentWaiting: lang === "tr" ? "Ödeme bekleniyor" : "Menunggu pembayaran",
    paymentWaitingText:
      lang === "tr"
        ? "Lütfen yukarıdaki hesaplardan uygun olanına ödemenizi gerçekleştirin."
        : "Silakan lakukan pembayaran ke rekening yang sesuai di atas.",
    close: lang === "tr" ? "Kapat" : "Tutup",
    increase: lang === "tr" ? "Artır" : "Tambah",
    decrease: lang === "tr" ? "Azalt" : "Kurangi",
    totalTL: lang === "tr" ? "TL Toplamı" : "Total TL",
    totalIDR: lang === "tr" ? "IDR Toplamı" : "Total IDR",
    loadingMenu: lang === "tr" ? "Menü yükleniyor..." : "Memuat menu...",
    emptyMenu:
      lang === "tr"
        ? "Menü henüz eklenmemiş. Lütfen yönetici panelinden ürün ekleyin."
        : "Menu belum ditambahkan. Silakan tambahkan produk dari panel admin.",
  };

  const categoryName = (category: Category) =>
    lang === "tr" ? category.nameTr : category.nameId;
  const productName = (product: Product) =>
    lang === "tr" ? product.nameTr : product.nameId;
  const productDescription = (product: Product) =>
    lang === "tr" ? product.descriptionTr : product.descriptionId;

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    const categorySortMap = new Map(categories.map((c) => [c.id, c.sortOrder]));
    return products
      .filter((product) => {
        const sectionMatch = product.section === menuSection;
        const categoryMatch =
          activeCategory === ALL_CATEGORY_ID || product.categoryId === activeCategory;
        const name = productName(product).toLocaleLowerCase("tr-TR");
        const desc = productDescription(product).toLocaleLowerCase("tr-TR");
        const searchMatch = !q || name.includes(q) || desc.includes(q);
        return sectionMatch && categoryMatch && searchMatch;
      })
      .sort((a, b) => {
        // "Tümü" seçiliyken önce kategoriye göre grupla, sonra kategori
        // içindeki sıraya göre diz.
        const catA = categorySortMap.get(a.categoryId) ?? 0;
        const catB = categorySortMap.get(b.categoryId) ?? 0;
        if (catA !== catB) return catA - catB;
        return a.sortOrder - b.sortOrder;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, search, products, lang, menuSection, categories]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.section === menuSection),
    [categories, menuSection]
  );

  // Market ürünlerinde (ikas'tan gelen), stokta olan miktardan fazlası
  // sepete eklenemez. Yemek ürünlerinde (menu section) stok takibi yok,
  // sınırsız.
  const maxQtyFor = (product: Product) =>
    product.stockQuantity != null ? product.stockQuantity : Infinity;

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      const maxQty = maxQtyFor(product);
      if (existing) {
        if (existing.quantity >= maxQty) {
          alert(
            lang === "tr"
              ? `Stokta sadece ${maxQty} adet var.`
              : `Stok tersedia hanya ${maxQty}.`
          );
          return current;
        }
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line
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
  const grandTotal = orderType === "delivery" ? cartTotal + (courierFee ?? 0) : cartTotal;
  const grandTotalIDR = grandTotal * idrRate;

  const fetchCourierFee = async (lat: number, lng: number) => {
    setCourierFeeLoading(true);
    setCourierFeeError(null);
    try {
      const res = await fetch("/api/delivery-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCourierFeeError(data.error || "Kurye ücreti hesaplanamadı.");
        setCourierFee(null);
        setCourierDistanceKm(null);
        return;
      }
      setCourierFee(data.feeTl);
      setCourierDistanceKm(data.distanceKm);
    } catch {
      setCourierFeeError("Kurye ücreti hesaplanamadı.");
      setCourierFee(null);
    } finally {
      setCourierFeeLoading(false);
    }
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setDeliveryLat(lat);
    setDeliveryLng(lng);
    fetchCourierFee(lat, lng);
  };

  // Telefon numarasını sadece rakamlara indirger (boşluk, tire, + işareti
  // fark etmesin diye) — hem kayıt hem arama sırasında bunu kullanıyoruz,
  // böylece "+62 812 345" ile "0812345" aynı numara olarak eşleşir.
  const normalizePhone = (value: string) => value.replace(/\D/g, "");

  // Telefon numarasından ayrılınca, o numarayla daha önce sipariş verilmiş mi
  // diye bakar; varsa isim/adres/not bilgilerini otomatik doldurur. Mevcut
  // yazılmış bir bilgiyi ASLA ezmez — sadece o alanlar boşsa doldurur.
  const lookupReturningCustomer = async () => {
    const phone = normalizePhone(customerPhone);
    if (phone.length < 8) return;

    const { data } = await supabase
      .from("orders")
      .select(
        "customer_name, delivery_address, delivery_lat, delivery_lng, delivery_note, leave_at_reception"
      )
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return;

    if (!customerName && data.customer_name) {
      setCustomerName(data.customer_name);
    }

    if (
      orderType === "delivery" &&
      !deliveryAddress &&
      data.delivery_address &&
      data.delivery_lat != null &&
      data.delivery_lng != null
    ) {
      setDeliveryAddress(data.delivery_address);
      setDeliveryLat(data.delivery_lat);
      setDeliveryLng(data.delivery_lng);
      setAddressNote(data.delivery_note ?? "");
      setLeaveAtReception(data.leave_at_reception ?? false);
      fetchCourierFee(data.delivery_lat, data.delivery_lng);
    }
  };

  const fetchPaytrToken = async (orderId: string) => {
    setPaytrLoading(true);
    setPaytrError(null);
    try {
      const res = await fetch("/api/paytr/get-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setPaytrError(
          data.error ||
            (lang === "tr" ? "Ödeme formu yüklenemedi." : "Formulir pembayaran gagal dimuat.")
        );
        return;
      }
      setPaytrToken(data.token);
    } catch {
      setPaytrError(
        lang === "tr" ? "Ödeme formu yüklenemedi." : "Formulir pembayaran gagal dimuat."
      );
    } finally {
      setPaytrLoading(false);
    }
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cart.length === 0 || submitting) return;

    if (orderType === "delivery") {
      if (deliveryLat == null || deliveryLng == null) {
        alert(
          lang === "tr"
            ? "Lütfen teslimat adresinizi haritadan seçin (öneri listesinden bir adres seçmeniz gerekiyor)."
            : "Silakan pilih alamat pengiriman Anda dari peta (pilih salah satu saran alamat)."
        );
        return;
      }
      if (courierFeeLoading) {
        alert(
          lang === "tr"
            ? "Kurye ücreti hesaplanıyor, lütfen birkaç saniye bekleyin."
            : "Ongkos kirim sedang dihitung, mohon tunggu."
        );
        return;
      }
      if (courierFee == null) {
        alert(
          lang === "tr"
            ? "Kurye ücreti hesaplanamadı. Lütfen adresi tekrar seçin."
            : "Ongkos kirim gagal dihitung. Silakan pilih alamat lagi."
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          source: orderType,
          customer_name: customerName,
          customer_phone: normalizePhone(customerPhone),
          delivery_address: orderType === "delivery" ? deliveryAddress || null : null,
          delivery_lat: orderType === "delivery" ? deliveryLat : null,
          delivery_lng: orderType === "delivery" ? deliveryLng : null,
          delivery_distance_km: orderType === "delivery" ? courierDistanceKm : null,
          delivery_note: orderType === "delivery" ? addressNote.trim() || null : null,
          leave_at_reception: orderType === "delivery" ? leaveAtReception : false,
          courier_fee_tl: orderType === "delivery" ? courierFee : 0,
          delivery_date: deliveryDate || null,
          delivery_time: deliveryTime || null,
          total_tl: grandTotal,
          total_idr: grandTotalIDR,
          sambal_requested: cart.some((line) => line.sambal),
          payment_status: "pending",
          order_status: "new",
        })
        .select("id, order_number")
        .single();

      if (orderError || !orderData) {
        console.error("ORDER KAYIT HATASI:", orderError);
        alert(
          lang === "tr"
            ? "Sipariş kaydedilemedi. Lütfen tekrar deneyin."
            : "Pesanan gagal disimpan. Silakan coba lagi."
        );
        return;
      }

      const orderItems = cart.map((line) => ({
        order_id: orderData.id,
        product_id: line.product.id,
        product_name_tr: line.product.nameTr,
        product_name_id: line.product.nameId,
        quantity: line.quantity,
        unit_price_tl: lineUnitPrice(line),
        unit_price_idr: lineUnitPrice(line) * idrRate,
        options: lineOptionCodes(line),
        item_note: line.note?.trim() || null,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("ORDER ITEMS KAYIT HATASI:", itemsError);
        alert(
          lang === "tr"
            ? "Sipariş ürünleri kaydedilemedi. Lütfen tekrar deneyin."
            : "Item pesanan gagal disimpan. Silakan coba lagi."
        );
        return;
      }

      setOrderNumber(`ID-${orderData.order_number}`);
      setCompletedOrderId(orderData.id);
      setCompletedTotalTL(grandTotal);
      setCompletedTotalIDR(grandTotalIDR);
      setOrderComplete(true);
      setCart([]);
      fetchPaytrToken(orderData.id);
    } catch (error) {
      console.error("SİPARİŞ HATASI:", error);
      alert(
        lang === "tr" ? "Beklenmeyen bir hata oluştu." : "Terjadi kesalahan tak terduga."
      );
    } finally {
      setSubmitting(false);
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
            <a
              href="/admin"
              className="hidden rounded-full border border-[#e4d3c1] px-3 py-2.5 text-xs font-bold text-[#6d5547] sm:block"
            >
              Admin
            </a>
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

        <div className="mx-auto max-w-6xl px-4 pb-3 pt-3 sm:px-6">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMenuSection("menu");
                setActiveCategory(ALL_CATEGORY_ID);
              }}
              className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                menuSection === "menu"
                  ? "bg-[#231710] text-white shadow-sm"
                  : "border border-[#e5d6c7] bg-white text-[#5b4032]"
              }`}
            >
              🍽️ {lang === "tr" ? "Menü" : "Menu"}
            </button>
            <button
              onClick={() => {
                setMenuSection("market");
                setActiveCategory(ALL_CATEGORY_ID);
              }}
              className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                menuSection === "market"
                  ? "bg-[#231710] text-white shadow-sm"
                  : "border border-[#e5d6c7] bg-white text-[#5b4032]"
              }`}
            >
              🛒 {lang === "tr" ? "Market" : "Pasar"}
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
              className="w-full rounded-2xl border border-[#e4d3c1] bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#a18b7b] focus:border-[#ef2b1e] focus:ring-2 focus:ring-[#ef2b1e]/10"
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
                  : "border border-[#e5d6c7] bg-white text-[#5b4032] hover:border-[#ef2b1e]/40"
              }`}
            >
              <span>✨</span>
              {lang === "tr" ? "Tümü" : "Semua"}
            </button>
            {visibleCategories.map((category) => (
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
                {categoryName(category)}
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
              {tr.heroText}
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
        <div className="rounded-2xl border border-[#e8d7c5] bg-[#fffaf3] p-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🌶️</div>
            <div>
              <div className="text-sm font-black">{tr.sambalTitle}</div>
              <p className="mt-1 text-xs leading-5 text-[#745d4e]">{tr.sambalInfo}</p>
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
              {activeCategory === ALL_CATEGORY_ID
                ? tr.popular
                : categoryName(visibleCategories.find((c) => c.id === activeCategory)!)}
            </h2>
          </div>
          <div className="text-xs font-semibold text-[#8b7566]">
            {visibleProducts.length} {tr.productsWord}
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-[#d8c5b2] bg-white/60 p-12 text-center">
            <p className="font-bold">{tr.loadingMenu}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d8c5b2] bg-white/60 p-12 text-center">
            <p className="font-bold">{tr.emptyMenu}</p>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#d8c5b2] bg-white/60 p-12 text-center">
            <div className="text-4xl">🔎</div>
            <p className="mt-3 font-bold">{tr.noProduct}</p>
            <button
              onClick={() => {
                setSearch("");
                setActiveCategory(ALL_CATEGORY_ID);
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
                <ProductVisual product={product} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black leading-tight">
                        {productName(product)}
                        <Spice count={product.spicy} />
                      </h3>
                      <p className="mt-2 min-h-10 text-xs leading-5 text-[#806b5b]">
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

      {cartCount > 0 && !checkoutOpen && (
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
          <p className="mt-2 text-xs text-[#806b5b]">{tr.traditionalDishes}</p>
          <p className="mt-4 text-xs text-[#a18b7b]">{tr.paymentInfo}</p>
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
                  <div className="mt-3 text-lg font-black text-[#ef2b1e]">
                    {formatTL(completedTotalTL)}
                  </div>
                </div>

                {!showBankInfo ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-2xl border border-[#e5d4c2] bg-white">
                      {paytrToken ? (
                        <>
                          <Script src="https://www.paytr.com/js/iframeResizer.min.js" strategy="afterInteractive" />
                          <iframe
                            src={`https://www.paytr.com/odeme/guvenli/${paytrToken}`}
                            id="paytriframe"
                            frameBorder={0}
                            scrolling="no"
                            style={{ width: "100%", minHeight: 480 }}
                          />
                        </>
                      ) : paytrLoading ? (
                        <div className="p-8 text-center text-sm font-bold text-[#806b5b]">
                          {tr.cardLoading}
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <p className="text-sm font-bold text-red-600">
                            {paytrError || tr.cardLoading}
                          </p>
                          <button
                            type="button"
                            onClick={() => completedOrderId && fetchPaytrToken(completedOrderId)}
                            className="mt-3 rounded-full bg-[#231710] px-4 py-2 text-xs font-bold text-white"
                          >
                            {tr.cardErrorRetry}
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBankInfo(true)}
                      className="w-full text-center text-xs font-bold text-[#806b5b] underline"
                    >
                      {tr.preferBankTransfer}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-[#6f5a4b]">{tr.paymentNote}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[#e5d4c2] bg-white p-5">
                        <div className="text-sm font-black">{tr.totalTL}</div>
                        <div className="mt-1 text-2xl font-black text-[#ef2b1e]">
                          {formatTL(completedTotalTL)}
                        </div>
                        <div className="mt-4 text-sm font-black">{tr.turkeyAccount}</div>
                        <div className="mt-2 rounded-xl bg-[#f8efe6] p-3 text-sm leading-7 text-[#6f5a4b]">
                          <div>
                            <span className="font-bold">
                              {lang === "tr" ? "Hesap sahibi" : "Nama pemilik"}:
                            </span>{" "}
                            {bankInfo.tlAccountName || "—"}
                          </div>
                          <div className="mt-1 break-all">
                            <span className="font-bold">IBAN:</span> {bankInfo.tlIban || "—"}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#e5d4c2] bg-white p-5">
                        <div className="text-sm font-black">{tr.totalIDR}</div>
                        <div className="mt-1 text-2xl font-black text-[#ef2b1e]">
                          {formatIDR(completedTotalIDR)}
                        </div>
                        <div className="mt-4 text-sm font-black">{tr.indonesiaAccount}</div>
                        <div className="mt-2 rounded-xl bg-[#f8efe6] p-3 text-sm leading-7 text-[#6f5a4b]">
                          <div>
                            <span className="font-bold">Bank:</span> {bankInfo.idrBank || "—"}
                          </div>
                          <div className="mt-1">
                            <span className="font-bold">
                              {lang === "tr" ? "Hesap sahibi" : "Nama pemilik"}:
                            </span>{" "}
                            {bankInfo.idrAccountName || "—"}
                          </div>
                          <div className="mt-1">
                            <span className="font-bold">
                              {lang === "tr" ? "Hesap No" : "Nomor rekening"}:
                            </span>{" "}
                            {bankInfo.idrAccountNumber || "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#231710] p-4 text-sm leading-6 text-white">
                      {tr.paymentWaitingText}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBankInfo(false)}
                      className="w-full text-center text-xs font-bold text-[#806b5b] underline"
                    >
                      {tr.hideBankTransfer}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setCheckoutOpen(false);
                    setOrderComplete(false);
                    setPaytrToken(null);
                    setPaytrError(null);
                    setShowBankInfo(false);
                    setDeliveryAddress("");
                    setDeliveryLat(null);
                    setDeliveryLng(null);
                    setCourierFee(null);
                    setCourierDistanceKm(null);
                    setAddressNote("");
                    setLeaveAtReception(false);
                    setOrderType("delivery");
                  }}
                  className="w-full rounded-2xl border border-[#e4d3c1] px-5 py-3 text-sm font-black text-[#5b4032]"
                >
                  {tr.close}
                </button>
              </div>
            ) : (
              <form onSubmit={submitOrder} className="space-y-5">
                {cart.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#d8c5b2] bg-white/60 p-6 text-center text-sm font-bold text-[#806b5b]">
                    {lang === "tr" ? "Sepetiniz boş." : "Keranjang Anda kosong."}
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

                          <input
                            value={line.note}
                            onChange={(event) =>
                              updateCartLine(line.product.id, { note: event.target.value })
                            }
                            placeholder={tr.itemNotePlaceholder}
                            maxLength={200}
                            className="mt-2 w-full rounded-xl border border-[#eee1d4] bg-[#fffaf4] px-3 py-2 text-xs outline-none focus:border-[#ef2b1e]"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#806b5b]">
                    {tr.orderTypeLabel}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["delivery", tr.orderTypeDelivery],
                        ["pickup", tr.orderTypePickup],
                        ["dinein", tr.orderTypeDinein],
                      ] as const
                    ).map(([type, label]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderType(type)}
                        className={`rounded-2xl px-3 py-3 text-xs font-black transition ${
                          orderType === type
                            ? "bg-[#ef2b1e] text-white shadow-sm"
                            : "border border-[#e5d4c2] bg-white text-[#5b4032]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-black">{tr.customerInfo}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      type="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      onBlur={lookupReturningCustomer}
                      placeholder={tr.phone}
                      className="sm:col-span-2 rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
                    />
                    <p className="-mt-1.5 text-[11px] font-bold text-[#a18b7b] sm:col-span-2">
                      {tr.phoneHint}
                    </p>
                    <input
                      required
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder={tr.name}
                      className="sm:col-span-2 rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
                    />
                    {orderType === "delivery" && (
                      <div className="sm:col-span-2">
                        <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                          {tr.addressSelectInstruction}
                        </p>
                        <AddressPicker
                          address={deliveryAddress}
                          onAddressChange={setDeliveryAddress}
                          onLocationChange={handleLocationChange}
                          placeholder={tr.address}
                          dragHint={tr.dragHint}
                          initialLat={deliveryLat}
                          initialLng={deliveryLng}
                        />
                        {courierFeeLoading && (
                          <p className="mt-2 text-xs font-bold text-[#806b5b]">{tr.courierCalculating}</p>
                        )}
                        {courierFeeError && (
                          <p className="mt-2 text-xs font-bold text-red-600">{courierFeeError}</p>
                        )}
                        {courierFee != null && !courierFeeLoading && (
                          <p className="mt-2 text-xs font-bold text-green-700">
                            🛵 {tr.courierFeeLabel}: {formatTL(courierFee)} ({courierDistanceKm} km)
                          </p>
                        )}

                        <textarea
                          value={addressNote}
                          onChange={(event) => setAddressNote(event.target.value)}
                          placeholder={tr.addressNotePlaceholder}
                          rows={2}
                          className="mt-3 w-full rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef2b1e]"
                        />
                        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-[#5b4032]">
                          <input
                            type="checkbox"
                            checked={leaveAtReception}
                            onChange={(event) => setLeaveAtReception(event.target.checked)}
                            className="h-4 w-4 accent-[#ef2b1e]"
                          />
                          🏨 {tr.leaveAtReception}
                        </label>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#806b5b]">
                        {tr.deliveryTimingLabel}
                      </p>
                      {!restaurantOpen && (
                        <p className="mb-2 text-xs font-bold text-red-600">
                          {lang === "tr"
                            ? "🕐 Şu anda kapalıyız, sadece ileri tarihli sipariş alabiliyoruz."
                            : "🕐 Kami sedang tutup, hanya menerima pesanan untuk waktu mendatang."}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!restaurantOpen}
                          onClick={() => {
                            setDeliveryTiming("now");
                            setDeliveryDate("");
                            setDeliveryTime("");
                          }}
                          className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            deliveryTiming === "now"
                              ? "bg-[#ef2b1e] text-white shadow-sm"
                              : "border border-[#e5d4c2] bg-white text-[#5b4032]"
                          }`}
                        >
                          ⚡ {tr.deliveryNow}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryTiming("scheduled")}
                          className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition ${
                            deliveryTiming === "scheduled"
                              ? "bg-[#ef2b1e] text-white shadow-sm"
                              : "border border-[#e5d4c2] bg-white text-[#5b4032]"
                          }`}
                        >
                          🗓️ {tr.deliveryScheduled}
                        </button>
                      </div>
                    </div>

                    {deliveryTiming === "scheduled" && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e5d4c2] bg-white p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#806b5b]">{tr.subtotalLabel}</span>
                    <span className="font-bold">{formatTL(cartTotal)}</span>
                  </div>
                  {orderType === "delivery" && (
                    <div className="mt-1 flex justify-between">
                      <span className="text-[#806b5b]">{tr.courierFeeLabel}</span>
                      <span className="font-bold">
                        {courierFee != null ? formatTL(courierFee) : "—"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#e5d4c2] bg-white p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-[#806b5b]">
                      {tr.totalTL}
                    </div>
                    <div className="mt-1 text-2xl font-black">{formatTL(grandTotal)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e5d4c2] bg-white p-4">
                    <div className="text-xs font-black uppercase tracking-wide text-[#806b5b]">
                      {tr.totalIDR}
                    </div>
                    <div className="mt-1 text-2xl font-black">{formatIDR(grandTotalIDR)}</div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    cart.length === 0 ||
                    submitting ||
                    (orderType === "delivery" &&
                      (courierFeeLoading || deliveryLat == null || courierFee == null))
                  }
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
