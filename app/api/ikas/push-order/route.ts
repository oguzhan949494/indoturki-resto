import { NextRequest, NextResponse } from "next/server";
import { pushOrderToIkasSafely } from "@/lib/ikas-order-push";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const orderId = body?.orderId as string | undefined;

  if (!orderId) {
    return NextResponse.json({ error: "orderId eksik." }, { status: 400 });
  }

  await pushOrderToIkasSafely(orderId);

  return NextResponse.json({ success: true });
}
