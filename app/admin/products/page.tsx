"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import {
  mapCategories,
  mapProducts,
  type Category,
  type Product,
} from "@/utils/menu-types";

export default function ProductImagesPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [yeniUrunAcik, setYeniUrunAcik] = useState(false);
  const [yeniUrun, setYeniUrun] = useState({
    name_tr: "",
    name_id: "",
    description_tr: "",
    description_id: "",
    price_tl: "",
    category_id: "",
    spicy_level: "0",
    is_new: false,
  });
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: categoryData } = await supabase
      .from("categories")
      .select("id, name_tr, name_id, emoji, sort_order, section")
      .order("sort_order", { ascending: true });

    const { data: productData } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });

    setCategories(mapCategories(categoryData));
    setProducts(mapProducts(productData));
    setLoading(false);
  }, [supabase]);

  const syncMarketProducts = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/ikas/sync-products", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`❌ ${data.error || "Senkronizasyon başarısız oldu."}`);
        return;
      }
      setSyncResult(`✅ ${data.totalSynced} market ürünü güncellendi.`);
      loadData();
    } catch {
      setSyncResult("❌ Senkronizasyon başarısız oldu.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = async (product: Product, file: File | null) => {
    if (!file) return;
    setErrorId(null);

    if (!file.type.startsWith("image/")) {
      setErrorId(product.id);
      return;
    }

    setUploadingId(product.id);

    try {
      const extension = file.name.split(".").pop() || "jpg";
      const path = `${product.id}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true, cacheControl: "3600" });

      if (uploadError) {
        console.error("Yükleme hatası:", uploadError);
        setErrorId(product.id);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("products")
        .update({ image_url: publicUrlData.publicUrl })
        .eq("id", product.id);

      if (updateError) {
        console.error("Ürün güncellenemedi:", updateError);
        setErrorId(product.id);
        return;
      }

      setProducts((current) =>
        current.map((p) =>
          p.id === product.id ? { ...p, imageUrl: publicUrlData.publicUrl } : p
        )
      );
    } finally {
      setUploadingId(null);
    }
  };

  const removeImage = async (product: Product) => {
    setUploadingId(product.id);
    try {
      const { error } = await supabase
        .from("products")
        .update({ image_url: null })
        .eq("id", product.id);

      if (error) {
        console.error(error);
        setErrorId(product.id);
        return;
      }

      setProducts((current) =>
        current.map((p) => (p.id === product.id ? { ...p, imageUrl: null } : p))
      );
    } finally {
      setUploadingId(null);
    }
  };

  const toggleAvailability = async (product: Product) => {
    const nextValue = !product.isAvailable;
    setErrorId(null);

    // Ekranı hemen güncelle (kullanıcı beklemesin), hata olursa geri al.
    setProducts((current) =>
      current.map((p) => (p.id === product.id ? { ...p, isAvailable: nextValue } : p))
    );

    const { error } = await supabase
      .from("products")
      .update({ is_available: nextValue })
      .eq("id", product.id);

    if (error) {
      console.error("Stok durumu güncellenemedi:", error);
      setErrorId(product.id);
      setProducts((current) =>
        current.map((p) => (p.id === product.id ? { ...p, isAvailable: !nextValue } : p))
      );
    }
  };

  const stokMiktariGuncelle = async (product: Product, deger: string) => {
    const sayi = deger.trim() === "" ? null : Math.max(0, parseInt(deger, 10) || 0);

    setProducts((current) =>
      current.map((p) => (p.id === product.id ? { ...p, stockQuantity: sayi } : p))
    );

    const { error } = await supabase
      .from("products")
      .update({ stock_quantity: sayi })
      .eq("id", product.id);

    if (error) {
      console.error("Stok miktarı güncellenemedi:", error);
      setErrorId(product.id);
    }
  };

  const yeniUrunKaydet = async () => {
    if (!yeniUrun.name_tr.trim() || !yeniUrun.price_tl || !yeniUrun.category_id) {
      alert("Ürün adı, fiyat ve kategori zorunludur.");
      return;
    }

    setKaydediliyor(true);

    const kategoriUrunleri = products.filter((p) => p.categoryId === yeniUrun.category_id);
    const maxSort =
      kategoriUrunleri.length > 0 ? Math.max(...kategoriUrunleri.map((p) => p.sortOrder)) : 0;

    const { error } = await supabase.from("products").insert({
      category_id: yeniUrun.category_id,
      name_tr: yeniUrun.name_tr.trim(),
      name_id: yeniUrun.name_id.trim() || yeniUrun.name_tr.trim(),
      description_tr: yeniUrun.description_tr.trim() || "",
      description_id: yeniUrun.description_id.trim() || yeniUrun.description_tr.trim() || "",
      price_tl: Number(yeniUrun.price_tl),
      spicy_level: Number(yeniUrun.spicy_level) || 0,
      is_new: yeniUrun.is_new,
      is_available: true,
      section: "menu",
      source: "manual",
      sort_order: maxSort + 10,
    });

    setKaydediliyor(false);

    if (error) {
      console.error("Ürün eklenemedi:", error);
      alert("Ürün eklenemedi. Tekrar deneyin.");
      return;
    }

    setYeniUrunAcik(false);
    setYeniUrun({
      name_tr: "",
      name_id: "",
      description_tr: "",
      description_id: "",
      price_tl: "",
      category_id: "",
      spicy_level: "0",
      is_new: false,
    });
    loadData();
  };

  const surukleBasla = (id: string) => setDraggedId(id);

  const surukleUzerine = (e: React.DragEvent) => e.preventDefault();

  const birak = async (hedefId: string, categoryId: string) => {
    if (!draggedId || draggedId === hedefId) return;

    const kategoriUrunleri = products
      .filter((p) => p.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const suruklenenIndex = kategoriUrunleri.findIndex((p) => p.id === draggedId);
    const hedefIndex = kategoriUrunleri.findIndex((p) => p.id === hedefId);
    if (suruklenenIndex === -1 || hedefIndex === -1) return;

    const yenidenSirali = [...kategoriUrunleri];
    const [tasinan] = yenidenSirali.splice(suruklenenIndex, 1);
    yenidenSirali.splice(hedefIndex, 0, tasinan);

    const guncellemeler = yenidenSirali.map((p, i) => ({ id: p.id, sort_order: (i + 1) * 10 }));

    setProducts((current) =>
      current.map((p) => {
        const u = guncellemeler.find((x) => x.id === p.id);
        return u ? { ...p, sortOrder: u.sort_order } : p;
      })
    );

    setDraggedId(null);

    for (const u of guncellemeler) {
      await supabase.from("products").update({ sort_order: u.sort_order }).eq("id", u.id);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f1ed] text-[#231710]">
      <header className="sticky top-0 z-20 border-b border-[#e2ddd3] bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">Ürün Yönetimi</h1>
            <p className="text-xs text-[#7a6f63]">
              Görsel yükle, stok durumunu aç/kapat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYeniUrunAcik(true)}
              className="rounded-full bg-[#ef2b1e] px-4 py-2 text-xs font-bold text-white"
            >
              + Yeni Ürün Ekle
            </button>
            <button
              onClick={syncMarketProducts}
              disabled={syncing}
              className="rounded-full bg-[#231710] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {syncing ? "Güncelleniyor..." : "🔄 Market Ürünlerini Güncelle"}
            </button>
            <Link
              href="/admin"
              className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
            >
              ← Panele Dön
            </Link>
          </div>
        </div>
        {syncResult && (
          <p className="mx-auto mt-2 max-w-5xl whitespace-pre-wrap break-all rounded-xl bg-[#f8f4ee] p-3 text-xs font-bold text-[#5b4032]">
            {syncResult}
          </p>
        )}
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {loading ? (
          <p className="text-center font-bold text-[#7a6f63]">Yükleniyor...</p>
        ) : (
          categories.map((category) => {
            const categoryProducts = products
              .filter((p) => p.categoryId === category.id)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            if (categoryProducts.length === 0) return null;

            return (
              <div key={category.id} className="mb-8">
                <h2 className="mb-3 text-lg font-black">
                  {category.emoji} {category.nameTr}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryProducts.map((product) => (
                    <div
                      key={product.id}
                      draggable={product.section === "menu"}
                      onDragStart={() => surukleBasla(product.id)}
                      onDragOver={surukleUzerine}
                      onDrop={() => birak(product.id, category.id)}
                      className={`rounded-2xl border border-[#e2ddd3] bg-white p-3 transition ${
                        product.isAvailable ? "" : "opacity-50"
                      } ${product.section === "menu" ? "cursor-move" : ""} ${
                        draggedId === product.id ? "opacity-30" : ""
                      }`}
                    >
                      {product.section === "menu" && (
                        <div className="mb-1 text-center text-xs text-[#c9beae]">⠿⠿⠿</div>
                      )}
                      <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-xl bg-[#f7eee3]">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.nameTr}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-4xl opacity-40">🍽️</span>
                        )}
                      </div>
                      <div className="text-sm font-black">{product.nameTr}</div>

                      <button
                        onClick={() => toggleAvailability(product)}
                        className={`mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-black transition ${
                          product.isAvailable
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        <span>{product.isAvailable ? "✅ Stokta" : "⛔ Tükendi"}</span>
                        <span
                          className={`relative h-5 w-9 rounded-full transition ${
                            product.isAvailable ? "bg-green-500" : "bg-[#d8cfc0]"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                              product.isAvailable ? "left-4" : "left-0.5"
                            }`}
                          />
                        </span>
                      </button>

                      {product.section === "menu" && (
                        <div className="mt-2">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-[#a18b7b]">
                            Stok Adedi (boş = sınırsız)
                          </label>
                          <input
                            type="number"
                            min={0}
                            defaultValue={product.stockQuantity ?? ""}
                            onBlur={(e) => stokMiktariGuncelle(product, e.target.value)}
                            placeholder="Sınırsız"
                            className="mt-1 w-full rounded-lg border border-[#e5d4c2] px-2 py-1.5 text-xs outline-none focus:border-[#ef2b1e]"
                          />
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2">
                        <label
                          className={`flex-1 cursor-pointer rounded-xl px-3 py-2 text-center text-xs font-bold text-white transition ${
                            uploadingId === product.id
                              ? "bg-[#c9beae] cursor-not-allowed"
                              : "bg-[#231710] hover:bg-[#3a251b]"
                          }`}
                        >
                          {uploadingId === product.id
                            ? "Yükleniyor..."
                            : product.imageUrl
                              ? "Görseli Değiştir"
                              : "Görsel Yükle"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingId === product.id}
                            className="hidden"
                            onChange={(event) =>
                              handleFileChange(product, event.target.files?.[0] ?? null)
                            }
                          />
                        </label>
                        {product.imageUrl && (
                          <button
                            onClick={() => removeImage(product)}
                            disabled={uploadingId === product.id}
                            className="rounded-xl border border-[#e5d4c2] px-3 py-2 text-xs font-bold text-[#7a6f63]"
                          >
                            Kaldır
                          </button>
                        )}
                      </div>
                      {errorId === product.id && (
                        <p className="mt-2 text-xs font-bold text-red-600">
                          Yükleme başarısız oldu. Tekrar dene.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {yeniUrunAcik && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">Yeni Ürün Ekle</h3>
              <button
                onClick={() => setYeniUrunAcik(false)}
                className="rounded-full border border-[#e4d3c1] px-3 py-1.5 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#7a6f63]">Kategori *</label>
                <select
                  value={yeniUrun.category_id}
                  onChange={(e) => setYeniUrun((u) => ({ ...u, category_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm outline-none focus:border-[#ef2b1e]"
                >
                  <option value="">Seçiniz...</option>
                  {categories
                    .filter((c) => c.section === "menu")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.nameTr}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#7a6f63]">Ürün Adı (Türkçe) *</label>
                <input
                  value={yeniUrun.name_tr}
                  onChange={(e) => setYeniUrun((u) => ({ ...u, name_tr: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm outline-none focus:border-[#ef2b1e]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#7a6f63]">
                  Ürün Adı (Endonezce) — boş bırakılırsa Türkçe adı kullanılır
                </label>
                <input
                  value={yeniUrun.name_id}
                  onChange={(e) => setYeniUrun((u) => ({ ...u, name_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm outline-none focus:border-[#ef2b1e]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#7a6f63]">Açıklama (Türkçe)</label>
                <textarea
                  value={yeniUrun.description_tr}
                  onChange={(e) => setYeniUrun((u) => ({ ...u, description_tr: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm outline-none focus:border-[#ef2b1e]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#7a6f63]">Fiyat (TL) *</label>
                <input
                  type="number"
                  min={0}
                  value={yeniUrun.price_tl}
                  onChange={(e) => setYeniUrun((u) => ({ ...u, price_tl: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm outline-none focus:border-[#ef2b1e]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#7a6f63]">Acılık Seviyesi</label>
                <select
                  value={yeniUrun.spicy_level}
                  onChange={(e) => setYeniUrun((u) => ({ ...u, spicy_level: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm outline-none focus:border-[#ef2b1e]"
                >
                  <option value="0">Acısız</option>
                  <option value="1">🌶️ 1</option>
                  <option value="2">🌶️ 2</option>
                  <option value="3">🌶️ 3</option>
                  <option value="4">🌶️ 4</option>
                  <option value="5">🌶️ 5</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={yeniUrun.is_new}
                  onChange={(e) => setYeniUrun((u) => ({ ...u, is_new: e.target.checked }))}
                  className="h-4 w-4"
                />
                "Yeni" rozeti göster
              </label>
            </div>

            <button
              onClick={yeniUrunKaydet}
              disabled={kaydediliyor}
              className="mt-5 w-full rounded-2xl bg-[#231710] py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {kaydediliyor ? "Kaydediliyor..." : "Ürünü Kaydet"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
