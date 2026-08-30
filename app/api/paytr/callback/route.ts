import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { pushOrderToIkasSafely } from "@/lib/ikas-order-push";

// PayTR bu adrese ödeme sonucunu POST eder (form-urlencoded).
// Cevap olarak DAİMA düz metin "OK" döndürmemiz gerekiyor, aksi halde
// PayTR aynı bildirimi tekrar tekrar göndermeye devam eder.
export async function POST(request: NextRequest) {
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

  if (!merchantKey || !merchantSalt) {
    console.error("PAYTR CALLBACK: merchant bilgileri eksik");
    return new NextResponse("PAYTR notification failed: config missing", { status: 500 });
  }

  const form = await request.formData();
  const merchantOid = String(form.get("merchant_oid") ?? "");
  const status = String(form.get("status") ?? "");
  const totalAmount = String(form.get("total_amount") ?? "");
  const hash = String(form.get("hash") ?? "");

  const expectedHash = crypto
    .createHmac("sha256", merchantKey)
    .update(merchantOid + merchantSalt + status + totalAmount)
    .digest("base64");

  if (expectedHash !== hash) {
    console.error("PAYTR CALLBACK: hash doğrulaması başarısız", { merchantOid });
    return new NextResponse("PAYTR notification failed: bad hash", { status: 400 });
  }

  // merchant_oid formatı: "{order_number}T{zaman damgası}" — bkz. get-token/route.ts
  const orderNumberMatch = /^(\d+)/.exec(merchantOid);
  const orderNumber = orderNumberMatch ? Number(orderNumberMatch[1]) : null;

  if (status === "success" && orderNumber) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: updatedOrder, error } = await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("order_number", orderNumber)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("PAYTR CALLBACK: sipariş güncellenemedi", error);
      } else if (updatedOrder) {
        await pushOrderToIkasSafely(updatedOrder.id);
      }
    }
  }

  // status === "failed" olsa bile PayTR'a "OK" döndürüyoruz; bildirimi
  // aldığımızı onaylamış oluyoruz, sipariş zaten "pending" kalır.
  return new NextResponse("OK");
}
