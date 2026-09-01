import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ikasGraphQL } from "@/lib/ikas-client";

// ikas'tan tüm ürünleri (kategorileriyle, varyant/stok/fiyat bilgisiyle)
// çeker ve Supabase'e "market" ürünleri olarak kaydeder.
//
// Performans notu: önceki sürüm her ürün için ayrı ayrı veritabanı
// sorgusu atıyordu (yavaş, çok ürünlü mağazalarda Vercel'in 10 saniyelik
// sınırını aşma riski vardı). Bu sürüm önce tüm veriyi ikas'tan toplar,
// sonra kategorileri ve ürünleri TOPLU (tek sorguda) kaydeder.

// ikas'ta her görsel şu adres kalıbıyla erişilebilir:
// https://cdn.myikas.com/images/{MAĞAZA_ID}/{GÖRSEL_ID}/image_{boyut}.webp
// Mağaza ID'si (aşağıdaki sabit) tüm görsellerde aynı, sadece görsel ID'si değişiyor.
const IKAS_STORE_ASSET_ID = "aeb81354-e524-4178-8a56-7b8d7eda742d";

function buildIkasImageUrl(imageId: string) {
  return `https://cdn.myikas.com/images/${IKAS_STORE_ASSET_ID}/${imageId}/image_2560.webp`;
}

const LIST_PRODUCT_QUERY = `
  query ListProducts($page: Int!, $limit: Int!) {
    listProduct(pagination: { page: $page, limit: $limit }) {
      data {
        id
        name
        description
        salesChannelIds
        categories {
          id
          name
        }
        variants {
          id
          sku
          barcodeList
          images {
            imageId
            isMain
            order
          }
          prices {
            sellPrice
          }
          stocks {
            stockCount
          }
        }
      }
      count
    }
  }
`;

async function runSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase ortam değişkenleri eksik." }, { status: 500 });
  }

  const supabase = createClient<any, any, any>(supabaseUrl, supabaseAnonKey);

  try {
    // ---------- 1) ikas'tan TÜM ürünleri hafızaya topla (henüz yazmadan) ----------
    const allIkasProducts: any[] = [];
    let page = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const data = await ikasGraphQL<any>(LIST_PRODUCT_QUERY, { page, limit });
      const products = data?.listProduct?.data ?? [];
      const totalCount = data?.listProduct?.count ?? 0;

      allIkasProducts.push(...products);

      page += 1;
      hasMore = page * limit < totalCount && products.length > 0;
    }

    // ---------- 2) Gerekli kategori adlarını çıkar ----------
    const categoryNames = new Set<string>();
    for (const product of allIkasProducts) {
      categoryNames.add(product.categories?.[0]?.name || "Market Ürünleri");
    }

    // Var olan ikas kategorilerini TEK sorguda çek
    const { data: existingCategories } = await supabase
      .from("categories")
      .select("id, name_tr")
      .eq("source", "ikas");

    const categoryNameToId = new Map<string, string>();
    for (const cat of existingCategories ?? []) {
      categoryNameToId.set(cat.name_tr, cat.id);
    }

    // Eksik kategorileri TEK seferde toplu ekle
    const missingCategoryNames = [...categoryNames].filter((name) => !categoryNameToId.has(name));
    if (missingCategoryNames.length > 0) {
      const { data: insertedCategories, error: insertCategoryError } = await supabase
        .from("categories")
        .insert(
          missingCategoryNames.map((name) => ({
            name_tr: name,
            name_id: name,
            emoji: "🛒",
            section: "market",
            source: "ikas",
            sort_order: 100,
          }))
        )
        .select("id, name_tr");

      if (insertCategoryError) {
        throw new Error("Kategori oluşturulamadı: " + insertCategoryError.message);
      }
      for (const cat of insertedCategories ?? []) {
        categoryNameToId.set(cat.name_tr, cat.id);
      }
    }

    // ---------- 2.5) Restoran menüsü ürünleriyle barkod eşleştirmesi ----------
    // Admin, "Ürün Yönetimi"nde bir restoran ürününe (yemek) barkod
    // girdiyse ve o barkod ikas'ta da varsa, o yemeği YENİ bir market
    // ürünü olarak eklemek yerine mevcut menü ürününe BAĞLIYORUZ (sadece
    // ikas_variant_id alanını dolduruyoruz — fiyat/ad/görsel değişmiyor).
    //
    // NOT: Önceki sürüm, ikas'taki TÜM ürünlerin barkodlarını (800+) tek
    // seferde ".in()" ile sorguluyordu — bu, sorgu adresinin çok uzun
    // olup reddedilmesine yol açıyordu. Bunun yerine SADECE barkodu
    // GİRİLMİŞ (muhtemelen az sayıda) menü ürününü çekip, eşleştirmeyi
    // bellek içinde yapıyoruz.
    const { data: menuProductsWithBarcode } = await supabase
      .from("products")
      .select("id, barcode")
      .eq("section", "menu")
      .not("barcode", "is", null);

    const menuBarcodeToProductId = new Map<string, string>();
    for (const m of menuProductsWithBarcode ?? []) {
      if (m.barcode) menuBarcodeToProductId.set(m.barcode, m.id);
    }

    // Bir varyantın gerçek (taranabilir) barkodunu döner — ikas'ta ayrı
    // bir "barcodeList" alanı var, o doluysa onu kullanıyoruz; boşsa
    // (bazı ürünlerde SKU ile barkod aynı olabildiği için) SKU'ya
    // düşüyoruz.
    const gercekBarkod = (variant: any): string | null =>
      variant?.barcodeList?.[0] || variant?.sku || null;

    if (menuBarcodeToProductId.size > 0) {
      for (const product of allIkasProducts) {
        const variant = product.variants?.[0];
        const barkod = gercekBarkod(variant);
        if (!barkod || !variant) continue;
        const menuProductId = menuBarcodeToProductId.get(barkod);
        if (menuProductId) {
          await supabase
            .from("products")
            .update({ ikas_product_id: product.id, ikas_variant_id: variant.id })
            .eq("id", menuProductId);
        }
      }
    }

    // ---------- 3) Ürünleri TEK seferde toplu kaydet (upsert) ----------
    const productPayloads = allIkasProducts
      .map((product) => {
        const variant = product.variants?.[0];
        if (!variant) return null;

        const barkod = gercekBarkod(variant);

        // Bu ürün bir restoran menü ürününe bağlandıysa, ayrıca market
        // ürünü olarak da eklemeye gerek yok (çift listeleme olmasın).
        if (barkod && menuBarcodeToProductId.has(barkod)) return null;

        const categoryName = product.categories?.[0]?.name || "Market Ürünleri";
        const categoryId = categoryNameToId.get(categoryName);
        if (!categoryId) return null;

        const priceEntry = Array.isArray(variant.prices) ? variant.prices[0] : variant.prices;
        const price = Number(priceEntry?.sellPrice ?? 0);
        const stock = (variant.stocks ?? []).reduce(
          (sum: number, s: any) => sum + (Number(s.stockCount) || 0),
          0
        );

        const mainImage =
          (variant.images ?? []).find((img: any) => img.isMain) ?? variant.images?.[0];
        const imageUrl = mainImage?.imageId ? buildIkasImageUrl(mainImage.imageId) : null;

        return {
          category_id: categoryId,
          name_tr: product.name,
          name_id: product.name,
          description_tr: product.description || "",
          description_id: product.description || "",
          price_tl: price,
          image_url: imageUrl,
          barcode: barkod,
          section: "market",
          source: "ikas",
          ikas_product_id: product.id,
          ikas_variant_id: variant.id,
          stock_quantity: stock,
          is_available: stock > 0,
          sort_order: 100,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // ikas'tan gelen listede aynı ürün (sayfalama örtüşmesi vb. yüzünden)
    // birden fazla kez görünmüş olabilir. Postgres, tek bir toplu UPSERT
    // içinde aynı satırı iki kez güncelleyemiyor, o yüzden burada
    // ikas_variant_id'ye göre tekilleştiriyoruz (son görüleni tutuyoruz).
    const dedupedPayloads = Array.from(
      new Map(productPayloads.map((p) => [p.ikas_variant_id, p])).values()
    );

    if (dedupedPayloads.length > 0) {
      const { error: upsertError } = await supabase
        .from("products")
        .upsert(dedupedPayloads, { onConflict: "ikas_variant_id" });

      if (upsertError) {
        throw new Error("Ürünler kaydedilemedi: " + upsertError.message);
      }
    }

    // İlk bulunan geçerli sales channel ID'sini bir kere kaydediyoruz —
    // sipariş oluştururken ikas'a hangi kanalı kullanacağımızı AÇIKÇA
    // söylememiz gerekiyor (yoksa "Stock location not found" hatası alıyoruz).
    const firstSalesChannelId = allIkasProducts.find(
      (p) => Array.isArray(p.salesChannelIds) && p.salesChannelIds.length > 0
    )?.salesChannelIds?.[0];

    if (firstSalesChannelId) {
      const { data: settingsRow } = await supabase
        .from("restaurant_settings")
        .select("id, ikas_default_sales_channel_id")
        .limit(1)
        .maybeSingle();

      if (settingsRow && !settingsRow.ikas_default_sales_channel_id) {
        await supabase
          .from("restaurant_settings")
          .update({ ikas_default_sales_channel_id: firstSalesChannelId })
          .eq("id", settingsRow.id);
      }
    }

    return NextResponse.json({ success: true, totalSynced: dedupedPayloads.length });
  } catch (error) {
    console.error("IKAS SENKRONIZASYON HATASI:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata." },
      { status: 500 }
    );
  }
}

// Vercel Cron, zamanlanmış görevleri GET isteğiyle çağırır.
export async function GET() {
  return runSync();
}

// Admin panelindeki "Market Ürünlerini Güncelle" butonu buradan çağırıyor.
export async function POST() {
  return runSync();
}
