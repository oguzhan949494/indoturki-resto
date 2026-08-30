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
      setSyncResult(
        `✅ ${data.totalSynced} market ürünü güncellendi.\n\n🔍 Görsel teşhis verisi (bunu Claude'a yapıştır):\n${data.debugImageSample}`
      );
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
            const categoryProducts = products.filter((p) => p.categoryId === category.id);
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
                      className={`rounded-2xl border border-[#e2ddd3] bg-white p-3 transition ${
                        product.isAvailable ? "" : "opacity-50"
                      }`}
                    >
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
    </main>
  );
}
