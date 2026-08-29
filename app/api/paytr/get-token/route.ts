import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const merchantId = process.env.PAYTR_MERCHANT_ID;
    const merchantKey = process.env.PAYTR_MERCHANT_KEY;
    const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
    const testMode = process.env.PAYTR_TEST_MODE === "1" ? "1" : "0";

    if (!merchantId || !merchantKey || !merchantSalt) {
      return NextResponse.json(
        { error: "PayTR bilgileri .env.local dosyasında tanımlı değil." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const orderId = body?.orderId as string | undefined;
    if (!orderId) {
      return NextResponse.json({ error: "orderId eksik." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase ortam değişkenleri eksik." }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, delivery_address, total_tl, order_items(product_name_tr, quantity, unit_price_tl)"
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
    }

    // Müşteriden e-posta istemiyoruz; PayTR'ın zorunlu tuttuğu bu alan için
    // işletmenin sabit e-postasını kullanıyoruz.
    const email = "indoturkimarket@gmail.com";

    const items = ((order as any).order_items ?? []) as {
      product_name_tr: string;
      quantity: number;
      unit_price_tl: number;
    }[];

    // Sepet toplamı, siparişin total_tl'i ile eşleşmeli.
    const totalTl = Number(order.total_tl);
    const paymentAmount = Math.round(totalTl * 100); // kuruş cinsinden, tam sayı

    const userBasketRaw = items.map((item) => [
      item.product_name_tr,
      item.unit_price_tl.toFixed(2),
      item.quantity,
    ]);
    const userBasket = Buffer.from(JSON.stringify(userBasketRaw)).toString("base64");

    // Aynı sipariş tekrar ödenmeye çalışılırsa (ilk deneme başarısız olduysa)
    // her denemede benzersiz bir merchant_oid üretmemiz gerekiyor. Başındaki
    // sipariş numarasından, callback geldiğinde hangi siparişe ait olduğunu
    // tekrar buluyoruz (bkz. app/api/paytr/callback/route.ts).
    const merchantOid = `${order.order_number}T${Date.now().toString(36)}`.toUpperCase();

    const forwardedFor = request.headers.get("x-forwarded-for");
    const userIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "127.0.0.1";

    const merchantOkUrl = `${request.nextUrl.origin}/odeme-basarili`;
    const merchantFailUrl = `${request.nextUrl.origin}/odeme-basarisiz`;

    const noInstallment = "0";
    const maxInstallment = "0";
    const currency = "TL";

    const hashStr =
      `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${userBasket}` +
      `${noInstallment}${maxInstallment}${currency}${testMode}`;

    const paytrToken = crypto
      .createHmac("sha256", merchantKey)
      .update(hashStr + merchantSalt)
      .digest("base64");

    const formBody = new URLSearchParams({
      merchant_id: merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: String(paymentAmount),
      paytr_token: paytrToken,
      user_basket: userBasket,
      debug_on: "1",
      no_installment: noInstallment,
      max_installment: maxInstallment,
      user_name: order.customer_name || "Müşteri",
      user_address: order.delivery_address || "Belirtilmedi",
      user_phone: order.customer_phone || "05000000000",
      merchant_ok_url: merchantOkUrl,
      merchant_fail_url: merchantFailUrl,
      timeout_limit: "30",
      currency,
      test_mode: testMode,
      lang: "tr",
    });

    const paytrResponse = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });

    const paytrResult = await paytrResponse.json();

    if (paytrResult.status !== "success") {
      console.error("PayTR token hatası:", paytrResult);
      return NextResponse.json(
        { error: paytrResult.reason || "PayTR'dan token alınamadı." },
        { status: 400 }
      );
    }

    return NextResponse.json({ token: paytrResult.token });
  } catch (error) {
    console.error("PAYTR GET-TOKEN HATASI:", error);
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
