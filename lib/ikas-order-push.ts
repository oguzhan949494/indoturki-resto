import { createClient } from "@supabase/supabase-js";
import { ikasGraphQL } from "./ikas-client";

const FOOD_PLACEHOLDER_NAME = "Restoran Ürünü";
const COURIER_PLACEHOLDER_NAME = "Kurye Ücreti";

const FIND_PLACEHOLDER_QUERY = `
  query FindPlaceholder($name: StringFilterInput) {
    listProduct(name: $name) {
      data {
        id
        name
        variants {
          id
        }
      }
    }
  }
`;

const CREATE_ORDER_MUTATION = `
  mutation CreateOrder($input: CreateOrderWithTransactionsInput!) {
    createOrderWithTransactions(input: $input) {
      id
      orderNumber
    }
  }
`;

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  return createClient<any, any, any>(supabaseUrl, supabaseAnonKey);
}

type PlaceholderKind = "food" | "courier";

const PLACEHOLDER_CONFIG: Record<
  PlaceholderKind,
  { name: string; productCol: string; variantCol: string }
> = {
  food: {
    name: FOOD_PLACEHOLDER_NAME,
    productCol: "ikas_placeholder_product_id",
    variantCol: "ikas_placeholder_variant_id",
  },
  courier: {
    name: COURIER_PLACEHOLDER_NAME,
    productCol: "ikas_courier_placeholder_product_id",
    variantCol: "ikas_courier_placeholder_variant_id",
  },
};

// Bir placeholder ürünün (Restoran Ürünü / Kurye Ücreti) ikas kimliğini
// bulur; ilk seferde ikas'ta arayıp restaurant_settings'e önbelleğe alır,
// sonrakilerde doğrudan önbellekten okur.
async function getPlaceholderIds(
  supabase: ReturnType<typeof createClient<any, any, any>>,
  kind: PlaceholderKind
) {
  const config = PLACEHOLDER_CONFIG[kind];

  const { data: settingsRaw } = await supabase
    .from("restaurant_settings")
    .select(`id, ${config.productCol}, ${config.variantCol}`)
    .limit(1)
    .maybeSingle();
  const settings = settingsRaw as any;

  if (settings?.[config.productCol] && settings?.[config.variantCol]) {
    return {
      productId: settings[config.productCol] as string,
      variantId: settings[config.variantCol] as string,
    };
  }

  const data = await ikasGraphQL<any>(FIND_PLACEHOLDER_QUERY, {
    name: { eq: config.name },
  });
  const found = data?.listProduct?.data?.[0];
  const variantId = found?.variants?.[0]?.id;

  if (!found || !variantId) {
    throw new Error(
      `ikas'ta "${config.name}" adında bir ürün bulunamadı. Lütfen bu isimde bir ürün oluşturun.`
    );
  }

  await supabase
    .from("restaurant_settings")
    .update({
      [config.productCol]: found.id,
      [config.variantCol]: variantId,
    })
    .eq("id", (settings as any)?.id ?? undefined);

  return { productId: found.id as string, variantId: variantId as string };
}

// Ödemesi onaylanmış bir paket servis siparişini ikas'a gerçek bir
// sipariş olarak gönderir. Yemek tutarı (+ kurye ücreti) placeholder
// ürüne, market ürünleri ise gerçek ikas ürün/varyant kimlikleriyle
// eklenir (bu sayede market stoğu otomatik düşer).
export async function pushOrderToIkas(orderId: string): Promise<void> {
  const supabase = getSupabase();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, source, customer_name, customer_phone, delivery_address, courier_fee_tl, pushed_to_ikas,
       order_items ( quantity, unit_price_tl, product_name_tr, product_id, products ( source, ikas_product_id, ikas_variant_id ) )`
    )
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error("Sipariş bulunamadı: " + orderId);
  }

  // Sadece paket servis siparişleri ikas'a gönderiliyor; masa/gel-al/
  // restoranda-yeme siparişleri ya da daha önce gönderilmiş bir sipariş
  // tekrar gönderilmiyor.
  if (order.source !== "delivery" || order.pushed_to_ikas) {
    return;
  }

  const { variantId: foodVariantId } = await getPlaceholderIds(supabase, "food");

  let foodTotal = 0;
  const marketLines: { variantId: string; quantity: number; price: number }[] = [];

  for (const item of (order as any).order_items ?? []) {
    const product = item.products;
    if (product?.source === "ikas" && product.ikas_variant_id) {
      marketLines.push({
        variantId: product.ikas_variant_id,
        quantity: item.quantity,
        price: Number(item.unit_price_tl),
      });
    } else {
      foodTotal += Number(item.unit_price_tl) * item.quantity;
    }
  }

  const orderLineItems: { variantId: string; quantity: number; price: number }[] = [];
  if (foodTotal > 0) {
    orderLineItems.push({ variantId: foodVariantId, quantity: 1, price: foodTotal });
  }

  const courierFee = Number(order.courier_fee_tl) || 0;
  if (courierFee > 0) {
    const { variantId: courierVariantId } = await getPlaceholderIds(supabase, "courier");
    orderLineItems.push({ variantId: courierVariantId, quantity: 1, price: courierFee });
  }

  orderLineItems.push(...marketLines);

  const variables = {
    input: {
      orderLineItems: orderLineItems.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
        price: line.price,
      })),
      customer: {
        firstName: order.customer_name || "Müşteri",
        phone: order.customer_phone || undefined,
      },
      note: `Indoturki Resto sipariş no: ID-${order.order_number}${
        order.delivery_address ? " — " + order.delivery_address : ""
      }`,
    },
  };

  const result = await ikasGraphQL<any>(CREATE_ORDER_MUTATION, variables);
  const ikasOrderId = result?.createOrderWithTransactions?.id ?? null;

  await supabase
    .from("orders")
    .update({ pushed_to_ikas: true, ikas_order_id: ikasOrderId, ikas_push_error: null })
    .eq("id", orderId);
}

// Hata durumunda siparişi "gönderilmedi" bırakıp hata mesajını kaydeder,
// böylece admin panelinde görülebilir ve tekrar denenebilir.
export async function pushOrderToIkasSafely(orderId: string): Promise<void> {
  try {
    await pushOrderToIkas(orderId);
  } catch (error) {
    console.error("IKAS SİPARİŞ GÖNDERME HATASI:", error);
    const supabase = getSupabase();
    await supabase
      .from("orders")
      .update({
        ikas_push_error: error instanceof Error ? error.message : "Bilinmeyen hata.",
      })
      .eq("id", orderId);
  }
}
