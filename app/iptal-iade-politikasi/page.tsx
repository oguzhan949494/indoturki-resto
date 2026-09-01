import Link from "next/link";

export default function IptalIadePage() {
  return (
    <main className="min-h-screen bg-[#f7eee3] px-4 py-10 text-[#231710]">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-xs font-bold text-[#a05a2c]">
          ← Ana Sayfaya Dön
        </Link>

        <h1 className="mt-4 text-2xl font-black">İptal ve İade Politikası</h1>

        <div className="mt-6 space-y-4 text-sm leading-6 text-[#5b4032]">
          <p>
            Indoturki Resto olarak, siparişlerin hızlı ve doğru şekilde hazırlanabilmesi için
            aşağıdaki iptal ve iade kurallarını uyguluyoruz.
          </p>

          <div>
            <h2 className="font-black text-[#231710]">1. Sipariş İptali</h2>
            <p>
              Siparişiniz mutfakta hazırlanmaya başlanmadan önce, bizi{" "}
              <a href="tel:+905013623800" className="underline">
                +90 501 362 38 00
              </a>{" "}
              numaralı telefondan arayarak ücretsiz olarak iptal edebilirsiniz. Siparişiniz
              hazırlanmaya başladıktan veya kurye tarafından yola çıkarıldıktan sonra iptal talebi
              kabul edilemez.
            </p>
          </div>

          <div>
            <h2 className="font-black text-[#231710]">2. Cayma Hakkı İstisnası</h2>
            <p>
              6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler
              Yönetmeliği uyarınca; niteliği itibarıyla iade edilemeyecek, çabuk bozulan veya son
              kullanma tarihi geçebilecek gıda maddeleri cayma hakkı kapsamı dışındadır. Bu
              nedenle teslim edilmiş yiyecek ve içeceklerde, aşağıdaki 3. madde kapsamındaki
              durumlar dışında iade/para iadesi yapılamamaktadır.
            </p>
          </div>

          <div>
            <h2 className="font-black text-[#231710]">3. Hatalı, Eksik veya Hasarlı Ürün</h2>
            <p>
              Teslim aldığınız siparişte eksik ürün, yanlış ürün veya taşıma kaynaklı bir sorun
              olduğunu düşünüyorsanız, teslimat anında veya en kısa süre içinde{" "}
              <a href="tel:+905013623800" className="underline">
                +90 501 362 38 00
              </a>{" "}
              numaralı telefondan bize ulaşın. Bu tür bildirimler tarafımızca değerlendirilerek,
              duruma göre ürünün yenilenmesi veya ücret iadesi sağlanır.
            </p>
          </div>

          <div>
            <h2 className="font-black text-[#231710]">4. Ödeme İadeleri</h2>
            <p>
              Onaylanan iade taleplerinde, ödeme yönteminize göre (kredi/banka kartı veya banka
              havalesi) tutar en kısa sürede iade edilir. Kart ile yapılan ödemelerin iadesi,
              bankanızın işlem sürelerine bağlı olarak birkaç iş günü sürebilir.
            </p>
          </div>

          <p className="pt-2 text-xs text-[#a18b7b]">
            Bu sayfa,{" "}
            <Link href="/mesafeli-satis-sozlesmesi" className="underline">
              Mesafeli Satış Sözleşmesi
            </Link>
            'nin bir parçasıdır.
          </p>
        </div>
      </div>
    </main>
  );
}
