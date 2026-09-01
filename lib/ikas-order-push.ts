import { createClient } from "@supabase/supabase-js";
import { ikasGraphQL } from "./ikas-client";

// ikas.dev resmi dokümantasyonundan doğrulanmış şema:
//   CreateOrderWithTransactionsInput { order: CreateOrderInput!, transactions: [OrderTransactionInput!]! }
//   CreateOrderInput { orderLineItems: [OrderLineItemInput!]!, customer, note, salesChannelId, ... }
//   OrderLineItemInput { variant: OrderLineVariantInput!, price: Float!, quantity: Float! }
//   OrderLineVariantInput { id: String, name: String }
//   OrderCustomerInput { id, email, firstName, lastName } -> telefon alanı YOK, notta iletiyoruz.
//   OrderTransactionInput { amount: Float!, paymentGatewayId: String }
//
// NOT: "id boş bırakılabilir" dense de, bu hesapta ID'siz (isim bazlı) satırlar
// "Stock location not found" hatası veriyor. Bu yüzden "Restoran Ürünü" ve
// "Kurye Ücreti" için de GERÇEK, ikas'ta kayıtlı ürünlerin varyant ID'lerini
// kullanıyoruz (ilk seferde isimle arayıp restaurant_settings'e önbelleğe alıyoruz).

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

// Bir placeholder ürünün (Restoran Ürünü / Kurye Ücreti) ikas varyant
// kimliğini bulur; ilk seferde ikas'ta arayıp restaurant_settings'e
// önbelleğe alır, sonrakilerde doğrudan önbellekten okur.
async function getPlaceholderVariantId(
  supabase: ReturnType<typeof createClient<any, any, any>>,
  kind: PlaceholderKind
): Promise<string> {
  const config = PLACEHOLDER_CONFIG[kind];

  const { data: settingsRaw } = await supabase
    .from("restaurant_settings")
    .select(`id, ${config.productCol}, ${config.variantCol}`)
    .limit(1)
    .maybeSingle();
  const settings = settingsRaw as any;

  if (settings?.[config.variantCol]) {
    return settings[config.variantCol] as string;
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

  if (settings?.id) {
    await supabase
      .from("restaurant_settings")
      .update({
        [config.productCol]: found.id,
        [config.variantCol]: variantId,
      })
      .eq("id", settings.id);
  }

  return variantId as string;
}

// Ödemesi onaylanmış bir paket servis siparişini ikas'a gerçek bir
// sipariş olarak gönderir. Yemek tutarı ve kurye ücreti, ikas'ta
// oluşturduğun gerçek "Restoran Ürünü" / "Kurye Ücreti" ürünlerinin
// varyant ID'leriyle eklenir; market ürünleri ise gerçek ikas varyant
// kimlikleriyle eklenir (bu sayede market stoğu otomatik düşer).
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

  let foodTotal = 0;
  const linkedLines: { variantId: string; quantity: number; price: number }[] = [];

  for (const item of (order as any).order_items ?? []) {
    const product = item.products;
    // Market ürünleri zaten ikas'tan geliyor; restoran menüsü ürünleri de
    // artık barkod eşleştirmesiyle ikas_variant_id kazanabiliyor — ikisi
    // de aynı şekilde, kendi gerçek satırında gönderiliyor. Eşleşmemiş
    // yemekler (ikas_variant_id yok) hâlâ toplu "Restoran Ürünü" altına.
    if (product?.ikas_variant_id) {
      linkedLines.push({
        variantId: product.ikas_variant_id,
        quantity: item.quantity,
        price: Number(item.unit_price_tl),
      });
    } else {
      foodTotal += Number(item.unit_price_tl) * item.quantity;
    }
  }

  const courierFee = Number(order.courier_fee_tl) || 0;

  const orderLineItems: { variant: { id: string }; price: number; quantity: number }[] = [];

  if (foodTotal > 0) {
    const foodVariantId = await getPlaceholderVariantId(supabase, "food");
    orderLineItems.push({ variant: { id: foodVariantId }, price: foodTotal, quantity: 1 });
  }
  if (courierFee > 0) {
    const courierVariantId = await getPlaceholderVariantId(supabase, "courier");
    orderLineItems.push({ variant: { id: courierVariantId }, price: courierFee, quantity: 1 });
  }
  for (const line of linkedLines) {
    orderLineItems.push({
      variant: { id: line.variantId },
      price: line.price,
      quantity: line.quantity,
    });
  }

  if (orderLineItems.length === 0) {
    return;
  }

  const totalAmount = orderLineItems.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const { data: settingsForChannel } = await supabase
    .from("restaurant_settings")
    .select("ikas_default_sales_channel_id")
    .limit(1)
    .maybeSingle();

  const salesChannelId = (settingsForChannel as any)?.ikas_default_sales_channel_id || undefined;

  const variables = {
    input: {
      order: {
        orderLineItems,
        customer: {
          firstName: order.customer_name || "Müşteri",
        },
        salesChannelId,
        note: `Indoturki Resto sipariş no: ID-${order.order_number} — Tel: ${
          order.customer_phone || "-"
        }${order.delivery_address ? " — " + order.delivery_address : ""}`,
      },
      transactions: [{ amount: totalAmount }],
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
