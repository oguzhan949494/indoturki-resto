export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7eee3] p-6 text-center text-[#231710]">
      <div className="max-w-sm rounded-3xl border border-[#e6d5c4] bg-white p-8 shadow-lg">
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-xl font-black">Ödemeniz alındı</h1>
        <p className="mt-2 text-sm leading-6 text-[#6f5a4b]">
          Siparişiniz onaylandı ve hazırlanmaya başlanacak. Bu sayfayı kapatabilirsiniz.
        </p>
      </div>
    </main>
  );
}
