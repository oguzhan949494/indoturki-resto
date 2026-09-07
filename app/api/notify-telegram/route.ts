import { NextRequest, NextResponse } from "next/server";

// TELEGRAM_CHAT_IDS: virgülle ayrılmış bir ya da daha fazla ID olabilir
// (tek bir grup, ya da birkaç farklı kişi/grup birden). Örnek:
// "-5501485757" ya da "-5501485757,123456789"
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const message = body?.message as string | undefined;

  if (!message) {
    return NextResponse.json({ error: "message eksik." }, { status: 400 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdsRaw = process.env.TELEGRAM_CHAT_IDS;

  if (!botToken || !chatIdsRaw) {
    // Telegram ayarlanmamışsa sessizce geç — sipariş akışını asla bozmasın.
    return NextResponse.json({ skipped: true });
  }

  const chatIds = chatIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  await Promise.all(
    chatIds.map((chatId) =>
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }).catch((err) => {
        console.error("Telegram gönderim hatası:", chatId, err);
      })
    )
  );

  return NextResponse.json({ success: true });
}
