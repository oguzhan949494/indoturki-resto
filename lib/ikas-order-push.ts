import { createClient } from "@supabase/supabase-js";
import { ikasGraphQL } from "./ikas-client";

// ikas.dev resmi dokümantasyonundan doğrulanmış şema:
//   CreateOrderWithTransactionsInput { order: CreateOrderInput!, transactions: [OrderTransactionInput!]! }
//   CreateOrderInput { orderLineItems: [OrderLineItemInput!]!, customer, note, ... }
//   OrderLineItemInput { variant: OrderLineVariantInput!, price: Float!, quantity: Float! }
//   OrderLineVariantInput { id: String, name: String }  -> id boş bırakılırsa "ikas'ta kayıtlı
//     olmayan ürün" olarak kabul ediliyor; biz "Restoran Ürünü" ve "Kurye Ücreti" satırları için
//     bunu kullanıyoruz (ayrıca ikas'ta placeholder ürün oluşturmaya gerek kalmadı).
//   OrderCustomerInput { id, email, firstName, lastName } -> telefon alanı YOK, notta iletiyoruz.
//   OrderTransactionInput { amount: Float!, paymentGatewayId: String }

const FOOD_LINE_NAME = "Restoran Ürünü";
const COURIER_LINE_NAME = "Kurye Ücreti";

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

// Ödemesi onaylanmış bir paket servis siparişini ikas'a gerçek bir
// sipariş olarak gönderir. Yemek tutarı ve kurye ücreti ayrı, serbest
// metin (kayıtsız ürün) satırları olarak eklenir; market ürünleri ise
// gerçek ikas varyant kimlikleriyle eklenir (bu sayede market stoğu
// otomatik düşer).
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

  const courierFee = Number(order.courier_fee_tl) || 0;

  const orderLineItems: { variant: { id?: string; name?: string }; price: number; quantity: number }[] = [];

  if (foodTotal > 0) {
    orderLineItems.push({ variant: { name: FOOD_LINE_NAME }, price: foodTotal, quantity: 1 });
  }
  if (courierFee > 0) {
    orderLineItems.push({ variant: { name: COURIER_LINE_NAME }, price: courierFee, quantity: 1 });
  }
  for (const line of marketLines) {
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

  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("ikas_default_sales_channel_id")
    .limit(1)
    .maybeSingle();

  const salesChannelId = (settings as any)?.ikas_default_sales_channel_id || undefined;

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
