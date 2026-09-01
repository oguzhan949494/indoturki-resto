import Link from "next/link";

export default function IletisimPage() {
  return (
    <main className="min-h-screen bg-[#f7eee3] px-4 py-10 text-[#231710]">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-xs font-bold text-[#a05a2c]">
          ← Ana Sayfaya Dön
        </Link>

        <h1 className="mt-4 text-2xl font-black">Adres ve İletişim Bilgileri</h1>

        <div className="mt-6 space-y-4 text-sm leading-6 text-[#5b4032]">
          <div>
            <div className="font-black text-[#231710]">Unvan</div>
            <p>Indoturki Resto — Oğuzhan AY (Şahıs Firması)</p>
          </div>

          <div>
            <div className="font-black text-[#231710]">Vergi Bilgileri</div>
            <p>Pendik Vergi Dairesi Müdürlüğü</p>
            <p>Vergi No: 61105266142</p>
            <p>Mersis No: 6110-5266-1420-0001</p>
          </div>

          <div>
            <div className="font-black text-[#231710]">Adres</div>
            <p>Karlıktepe Mahallesi, Misafir Sokak No:2B, Kartal / İstanbul</p>
          </div>

          <div>
            <div className="font-black text-[#231710]">Telefon</div>
            <p>
              <a href="tel:+905013623800" className="underline">
                +90 501 362 38 00
              </a>
            </p>
          </div>

          <div>
            <div className="font-black text-[#231710]">E-posta</div>
            <p>
              <a href="mailto:indoturkimarket@gmail.com" className="underline">
                indoturkimarket@gmail.com
              </a>
            </p>
          </div>

          <div>
            <div className="font-black text-[#231710]">Ortalama Teslimat Süresi</div>
            <p>
              Siparişler, adrese ve yoğunluğa bağlı olarak ortalama 30-45 dakika içinde teslim
              edilir. Yoğun saatlerde bu süre uzayabilir; herhangi bir gecikme durumunda
              müşterilerimiz telefonla bilgilendirilir.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
