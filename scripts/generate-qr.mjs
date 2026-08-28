// Masa başına bir QR kod üretir: /menu?masa=1, /menu?masa=2, ...
// Kullanım:
//   BASE_URL=https://siteniz.com TABLE_COUNT=6 npm run generate-qr
//
// .env.local dosyasındaki değerleri de otomatik okur, o yüzden
// istersen sadece: npm run generate-qr

import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TABLE_COUNT = Number(process.env.TABLE_COUNT || 6);

const outDir = path.resolve("qr-codes");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log(`\n📱 ${TABLE_COUNT} masa için QR kod üretiliyor...`);
  console.log(`🔗 Temel adres: ${BASE_URL}\n`);

  for (let tableNumber = 1; tableNumber <= TABLE_COUNT; tableNumber++) {
    const url = `${BASE_URL}/menu?masa=${tableNumber}`;
    const filePath = path.join(outDir, `masa-${tableNumber}.png`);

    await QRCode.toFile(filePath, url, {
      width: 800,
      margin: 2,
      color: { dark: "#231710", light: "#ffffff" },
    });

    console.log(`✅ Masa ${tableNumber} → ${url}`);
    console.log(`   Dosya: ${filePath}`);
  }

  console.log(`\n🎉 Tamamlandı! Tüm QR kodlar "qr-codes" klasöründe.`);
  console.log(`   Bunları yazdırıp masalara yapıştırabilirsin.\n`);
}

run().catch((err) => {
  console.error("QR üretimi başarısız:", err);
  process.exit(1);
});
