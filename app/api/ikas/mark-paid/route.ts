import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushOrderToIkasSafely } from "@/lib/ikas-order-push";

export async function POST(request: NextRequest) {
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

  const supabase = createClient<any, any, any>(supabaseUrl, supabaseAnonKey);

  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", orderId);

  if (error) {
    return NextResponse.json({ error: "Sipariş güncellenemedi." }, { status: 500 });
  }

  // ikas'a gönderme işlemi başarısız olsa bile "ödendi" işaretlemesi geçerli
  // kalsın diye hatayı burada yutuyoruz (hata orders.ikas_push_error'a yazılır).
  await pushOrderToIkasSafely(orderId);

  return NextResponse.json({ success: true });
}
