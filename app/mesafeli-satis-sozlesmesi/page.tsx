import Link from "next/link";

export default function MesafeliSatisPage() {
  return (
    <main className="min-h-screen bg-[#f7eee3] px-4 py-10 text-[#231710]">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-xs font-bold text-[#a05a2c]">
          ← Ana Sayfaya Dön
        </Link>

        <h1 className="mt-4 text-2xl font-black">Mesafeli Satış Sözleşmesi</h1>

        <div className="mt-6 space-y-5 text-sm leading-6 text-[#5b4032]">
          <section>
            <h2 className="font-black text-[#231710]">Madde 1 — Taraflar</h2>
            <p>
              İşbu Mesafeli Satış Sözleşmesi ("Sözleşme"), aşağıda bilgileri yer alan SATICI ile
              siparişi veren ALICI arasında, ALICI'nın SATICI'ya ait{" "}
              <span className="font-bold">indoturki-resto.vercel.app</span> internet sitesi
              üzerinden elektronik ortamda verdiği sipariş kapsamında akdedilmiştir.
            </p>
            <p className="mt-2">
              <span className="font-bold">SATICI:</span> Indoturki Resto — Oğuzhan AY (Şahıs
              Firması)
              <br />
              <span className="font-bold">Adres:</span> Karlıktepe Mahallesi, Misafir Sokak
              No:2B, Kartal / İstanbul
              <br />
              <span className="font-bold">Vergi Dairesi:</span> Pendik Vergi Dairesi Müdürlüğü —{" "}
              <span className="font-bold">Vergi No:</span> 61105266142
              <br />
              <span className="font-bold">Mersis No:</span> 6110-5266-1420-0001
              <br />
              <span className="font-bold">Telefon:</span> +90 501 362 38 00
              <br />
              <span className="font-bold">E-posta:</span> indoturkimarket@gmail.com
            </p>
            <p className="mt-2">
              <span className="font-bold">ALICI:</span> Sipariş sırasında ad-soyad, telefon ve
              teslimat adresi bilgilerini paylaşan gerçek/tüzel kişi.
            </p>
          </section>

          <section>
            <h2 className="font-black text-[#231710]">Madde 2 — Sözleşmenin Konusu</h2>
            <p>
              İşbu Sözleşme'nin konusu, ALICI'nın SATICI'ya ait internet sitesi üzerinden
              elektronik ortamda siparişini verdiği yiyecek ve içeceklerin satışı ve teslimi ile
              ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli
              Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin
              belirlenmesidir.
            </p>
          </section>

          <section>
            <h2 className="font-black text-[#231710]">Madde 3 — Sipariş ve Ödeme</h2>
            <p>
              ALICI, internet sitesi üzerinden seçtiği ürünleri sepetine ekleyerek, teslimat
              adresini ve iletişim bilgilerini girmek suretiyle siparişini oluşturur. Ödeme,
              kredi/banka kartı ile online ödeme ya da banka havalesi yöntemlerinden biriyle
              yapılır. Sipariş onayı, ödemenin başarıyla tamamlanmasının ardından ALICI'ya
              elektronik ortamda bildirilir.
            </p>
          </section>

          <section>
            <h2 className="font-black text-[#231710]">Madde 4 — Teslimat</h2>
            <p>
              Siparişler, ALICI tarafından belirtilen adrese kurye ile teslim edilir. Ortalama
              teslimat süresi 30-45 dakikadır; yoğunluk, mesafe veya hava koşulları gibi
              nedenlerle bu süre uzayabilir. Adres bilgisinin eksik veya hatalı verilmesinden
              doğacak teslimat gecikmelerinden SATICI sorumlu tutulamaz.
            </p>
          </section>

          <section>
            <h2 className="font-black text-[#231710]">Madde 5 — Cayma Hakkı ve İptal</h2>
            <p>
              Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca, niteliği itibarıyla iade
              edilemeyecek, çabuk bozulan veya son kullanma tarihi geçebilecek gıda maddeleri
              cayma hakkı kapsamı dışındadır. Bu doğrultuda ALICI, siparişini yalnızca mutfakta
              hazırlanmaya başlanmadan önce iptal edebilir. İptal, iade ve sipariş sonrası ortaya
              çıkan sorunlara ilişkin ayrıntılı kurallar{" "}
              <Link href="/iptal-iade-politikasi" className="underline">
                İptal ve İade Politikası
              </Link>{" "}
              sayfasında yer almaktadır.
            </p>
          </section>

          <section>
            <h2 className="font-black text-[#231710]">Madde 6 — Uyuşmazlıkların Çözümü</h2>
            <p>
              İşbu Sözleşme'den doğan uyuşmazlıklarda, Ticaret Bakanlığı'nca ilan edilen değere
              kadar ALICI'nın yerleşim yerindeki Tüketici Hakem Heyetleri ile Tüketici
              Mahkemeleri yetkilidir.
            </p>
          </section>

          <section>
            <h2 className="font-black text-[#231710]">Madde 7 — Yürürlük</h2>
            <p>
              ALICI, internet sitesi üzerinden siparişini onaylayarak işbu Sözleşme'nin tüm
              koşullarını kabul etmiş sayılır.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
