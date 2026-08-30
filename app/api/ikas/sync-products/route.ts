import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ikasGraphQL } from "@/lib/ikas-client";

// ikas'tan tüm ürünleri (kategorileriyle, varyant/stok/fiyat bilgisiyle)
// çeker ve Supabase'e "market" ürünleri olarak kaydeder.
//
// NOT: ikas'ın tam GraphQL alan isimleri (özellikle stok/fiyat yapısı)
// dokümantasyonda dağınık; ilk çalıştırmada bir alan hatası gelirse,
// hatayı olduğu gibi bize iletin, tek seferde düzeltilir.

const LIST_PRODUCT_QUERY = `
  query ListProducts($page: Int!, $limit: Int!) {
    listProduct(pagination: { page: $page, limit: $limit }) {
      data {
        id
        name
        description
        categories {
          id
          name
        }
        variants {
          id
          sku
          prices {
            sellPrice
          }
          images {
            imageId
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
    let page = 0;
    const limit = 100;
    let totalSynced = 0;
    let hasMore = true;

    // Bu senkronizasyonda görülen kategori adı -> bizim kategori id'miz eşlemesi
    const categoryCache = new Map<string, string>();

    while (hasMore) {
      const data = await ikasGraphQL<any>(LIST_PRODUCT_QUERY, { page, limit });
      const products = data?.listProduct?.data ?? [];
      const totalCount = data?.listProduct?.count ?? 0;

      for (const product of products) {
        const categoryName = product.categories?.[0]?.name || "Market Ürünleri";
        const ikasCategoryId = product.categories?.[0]?.id || null;

        let categoryId = categoryCache.get(categoryName);
        if (!categoryId) {
          const { data: existingCategory } = await supabase
            .from("categories")
            .select("id")
            .eq("source", "ikas")
            .eq("name_tr", categoryName)
            .maybeSingle();

          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            const { data: newCategory, error: categoryError } = await supabase
              .from("categories")
              .insert({
                name_tr: categoryName,
                name_id: categoryName,
                emoji: "🛒",
                section: "market",
                source: "ikas",
                ikas_category_id: ikasCategoryId,
                sort_order: 100,
              })
              .select("id")
              .single();

            if (categoryError || !newCategory) {
              console.error("Kategori oluşturulamadı:", categoryError);
              continue;
            }
            categoryId = newCategory.id;
          }
          categoryCache.set(categoryName, categoryId as string);
        }

        const variant = product.variants?.[0];
        if (!variant) continue;

        const price = Number(variant.prices?.sellPrice ?? 0);
        const stock = variant.stocks?.reduce(
          (sum: number, s: any) => sum + (Number(s.stockCount) || 0),
          0
        );

        const { data: existingProduct } = await supabase
          .from("products")
          .select("id")
          .eq("ikas_variant_id", variant.id)
          .maybeSingle();

        const productPayload = {
          category_id: categoryId,
          name_tr: product.name,
          name_id: product.name,
          description_tr: product.description || "",
          description_id: product.description || "",
          price_tl: price,
          section: "market",
          source: "ikas",
          ikas_product_id: product.id,
          ikas_variant_id: variant.id,
          stock_quantity: stock,
          is_available: stock > 0,
          sort_order: 100,
        };

        if (existingProduct) {
          await supabase.from("products").update(productPayload).eq("id", existingProduct.id);
        } else {
          await supabase.from("products").insert(productPayload);
        }

        totalSynced += 1;
      }

      page += 1;
      hasMore = page * limit < totalCount;
    }

    return NextResponse.json({ success: true, totalSynced });
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
