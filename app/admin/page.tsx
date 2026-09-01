"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { OPTION_LABELS } from "@/utils/menu-types";

type OrderItemRow = {
  id: string;
  product_name_tr: string;
  quantity: number;
  unit_price_tl: number;
  item_note: string | null;
  options: string[] | null;
  dynamic_options: { label: string; priceDelta: number }[] | null;
};

type OrderRow = {
  id: string;
  order_number: number;
  source: "delivery" | "table" | "pickup" | "dinein";
  table_id: string | null;
  is_takeaway: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_note: string | null;
  pushed_to_ikas: boolean;
  ikas_push_error: string | null;
  leave_at_reception: boolean;
  delivery_lat: number | null;
  delivery_lng: number | null;
  courier_fee_tl: number | null;
  delivery_distance_km: number | null;
  total_tl: number;
  sambal_requested: boolean;
  order_status: string;
  payment_status: string;
  created_at: string;
  order_items: OrderItemRow[];
  restaurant_tables: { table_number: number } | null;
};

type StaffCallRow = {
  id: string;
  table_id: string;
  call_type: string;
  status: string;
  created_at: string;
  restaurant_tables: { table_number: number } | null;
};

const ORDER_STATUS_FLOW = ["new", "preparing", "ready", "completed"];
const ORDER_STATUS_LABEL: Record<string, string> = {
  new: "🆕 Yeni",
  preparing: "👨‍🍳 Hazırlanıyor",
  ready: "✅ Hazır",
  completed: "📦 Tamamlandı",
};

const CALL_TYPE_LABEL: Record<string, string> = {
  garson: "🙋 Garson",
  hesap: "🧾 Hesap",
  su: "💧 Su",
  diger: "🔔 Diğer",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} sa önce`;
}

const ORDER_SOURCE_LABEL: Record<string, string> = {
  delivery: "🚚 Paket Servis",
  pickup: "🏃 Gel Al",
  dinein: "🍽️ Restoranda Yiyor",
  table: "🍽️ Masa",
};

// Mutfak fişi — sadece yazdırırken görünür, ekranda hiç gösterilmez.
function MutfakFisi({ order }: { order: OrderRow }) {
  const kaynakYazi =
    order.source === "table"
      ? `🍽️ Masa ${order.restaurant_tables?.table_number ?? "?"}${order.is_takeaway ? " — 📦 AL-GÖTÜR" : ""}`
      : ORDER_SOURCE_LABEL[order.source] ?? order.source;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#000", fontSize: 12, lineHeight: 1.5 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>INDOTURKI RESTO</div>
        <div style={{ fontSize: 11 }}>MUTFAK FİŞİ</div>
      </div>
      <p style={{ margin: 0, fontWeight: 700 }}>ID-{order.order_number}</p>
      <p style={{ margin: 0 }}>{kaynakYazi}</p>
      <p style={{ margin: 0 }}>{new Date(order.created_at).toLocaleString("tr-TR")}</p>

      {order.source !== "table" && (
        <div style={{ marginTop: 6 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{order.customer_name}</p>
          <p style={{ margin: 0 }}>{order.customer_phone}</p>
        </div>
      )}

      {order.source === "delivery" && (
        <div style={{ marginTop: 4 }}>
          <p style={{ margin: 0 }}>{order.delivery_address}</p>
          {order.leave_at_reception && (
            <p style={{ margin: 0, fontWeight: 700 }}>🏨 Resepsiyona bırakılacak</p>
          )}
          {order.delivery_note && <p style={{ margin: 0 }}>Not: {order.delivery_note}</p>}
        </div>
      )}

      <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", marginTop: 8 }}>
        {order.order_items.map((item) => (
          <div key={item.id} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>
                {item.quantity}x {item.product_name_tr}
              </span>
            </div>
            {item.options && item.options.length > 0 && (
              <div style={{ fontSize: 11 }}>
                {item.options.map((code) => `• ${OPTION_LABELS[code]?.tr ?? code}`).join("  ")}
              </div>
            )}
            {item.dynamic_options && item.dynamic_options.length > 0 && (
              <div style={{ fontSize: 11 }}>
                {item.dynamic_options.map((o) => `• ${o.label}`).join("  ")}
              </div>
            )}
            {item.item_note && <div style={{ fontSize: 11, fontStyle: "italic" }}>📝 {item.item_note}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 6, fontSize: 13 }}>
        <span>Toplam</span>
        <span>{order.total_tl.toLocaleString("tr-TR")} TL</span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "calls">("orders");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [calls, setCalls] = useState<StaffCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [printingOrder, setPrintingOrder] = useState<OrderRow | null>(null);
  const [openingTime, setOpeningTime] = useState("10:00");
  const [closingTime, setClosingTime] = useState("22:00");
  const [manualStatus, setManualStatus] = useState<"auto" | "force_open" | "force_closed">(
    "auto"
  );
  const [hoursSaving, setHoursSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, source, table_id, is_takeaway, customer_name, customer_phone, delivery_address, delivery_lat, delivery_lng, delivery_note, leave_at_reception, pushed_to_ikas, ikas_push_error, courier_fee_tl, delivery_distance_km, total_tl, sambal_requested, order_status, payment_status, created_at, order_items(id, product_name_tr, quantity, unit_price_tl, item_note, options, dynamic_options), restaurant_tables(table_number)"
      )
      .neq("order_status", "completed")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Siparişler alınamadı:", error);
      return;
    }
    setOrders((data as unknown as OrderRow[]) ?? []);
  }, [supabase]);

  const loadCalls = useCallback(async () => {
    const { data, error } = await supabase
      .from("staff_calls")
      .select("id, table_id, call_type, status, created_at, restaurant_tables(table_number)")
      .neq("status", "done")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Çağrılar alınamadı:", error);
      return;
    }
    setCalls((data as unknown as StaffCallRow[]) ?? []);
  }, [supabase]);

  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);

  // Yeni sipariş geldiğinde çalan asıl bildirim sesi.
  const playNewOrderSound = useCallback(() => {
    if (!soundOn) return;
    try {
      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new Audio("/sounds/new-order.mp3");
      }
      const audio = notificationAudioRef.current;
      audio.currentTime = 0;
      audio.play().catch(() => {
        // tarayıcı otomatik ses politikası engelleyebilir - sayfayla bir kez
        // etkileşime girildikten sonra (tıklama vb.) normalde çalışır
      });
    } catch {
      // sessizce yut
    }
  }, [soundOn]);

  // Diğer olaylar (personel çağrısı gibi) için kısa, basit bir bip sesi —
  // ses dosyasına ihtiyaç duymadan tarayıcıda anlık üretiliyor.
  const playBeep = useCallback(() => {
    if (!soundOn) return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // sessizce yut
    }
  }, [soundOn]);

  const loadHoursSettings = useCallback(async () => {
    const { data } = await supabase
      .from("restaurant_settings")
      .select("opening_time, closing_time, manual_status")
      .limit(1)
      .maybeSingle();
    if (data) {
      setOpeningTime((data.opening_time as string)?.slice(0, 5) ?? "10:00");
      setClosingTime((data.closing_time as string)?.slice(0, 5) ?? "22:00");
      setManualStatus((data.manual_status as any) ?? "auto");
    }
  }, [supabase]);

  const saveHoursSettings = async (patch: {
    opening_time?: string;
    closing_time?: string;
    manual_status?: "auto" | "force_open" | "force_closed";
  }) => {
    setHoursSaving(true);
    const { data: row, error: rowError } = await supabase
      .from("restaurant_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (rowError || !row?.id) {
      console.error("ÇALIŞMA SAATLERİ: ayar satırı bulunamadı", rowError);
      setHoursSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("restaurant_settings")
      .update(patch)
      .eq("id", row.id);

    if (updateError) {
      console.error("ÇALIŞMA SAATLERİ KAYDEDİLEMEDİ:", updateError);
    }

    setHoursSaving(false);
  };

  useEffect(() => {
    loadHoursSettings();
  }, [loadHoursSettings]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOrders(), loadCalls()]).finally(() => setLoading(false));

    const ordersChannel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          playNewOrderSound();
          loadOrders();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => loadOrders()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        () => loadOrders()
      )
      .subscribe();

    const itemsChannel = supabase
      .channel("admin-order-items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => loadOrders()
      )
      .subscribe();

    const callsChannel = supabase
      .channel("admin-staff-calls")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_calls" },
        () => {
          playBeep();
          loadCalls();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "staff_calls" },
        () => loadCalls()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(itemsChannel);
      supabase.removeChannel(callsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceOrderStatus = async (order: OrderRow) => {
    const currentIndex = ORDER_STATUS_FLOW.indexOf(order.order_status);
    const next = ORDER_STATUS_FLOW[Math.min(currentIndex + 1, ORDER_STATUS_FLOW.length - 1)];
    const { error } = await supabase
      .from("orders")
      .update({ order_status: next })
      .eq("id", order.id);
    if (error) console.error(error);
  };

  // Mutfak fişini yazdırır — arka planda görünmez alanı doldurur,
  // tarayıcının yazdırma diyaloğunu açar.
  const yazdir = (order: OrderRow) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
      setPrintingOrder(null);
    }, 150);
  };

  const markPaid = async (order: OrderRow) => {
    const res = await fetch("/api/ikas/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    if (!res.ok) {
      console.error("Ödendi işaretlenemedi");
      return;
    }
    loadOrders();
  };

  const resolveCall = async (call: StaffCallRow) => {
    const { error } = await supabase
      .from("staff_calls")
      .update({ status: "done" })
      .eq("id", call.id);
    if (error) console.error(error);
  };

  const handleLogout = async () => {
    await fetch("/api/admin-logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <>
    <main className="ekran-icerigi min-h-screen bg-[#f3f1ed] text-[#231710]">
      <header className="sticky top-0 z-20 border-b border-[#e2ddd3] bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Indoturki Resto — Yönetici Paneli</h1>
            <p className="text-xs text-[#7a6f63]">Canlı sipariş ve personel çağrı takibi</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/secenekler"
              className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
            >
              ⚙️ Seçenek Yönetimi
            </Link>
            <Link
              href="/admin/masalar"
              className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
            >
              🍽️ Masa Takip
            </Link>
            <Link
              href="/admin/pos"
              className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
            >
              🧾 Resto POS
            </Link>
            <Link
              href="/siparis-panel"
              className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
            >
              🖨️ Sipariş & Fiş Paneli
            </Link>
            <Link
              href="/admin/products"
              className="rounded-full border border-[#e2ddd3] px-4 py-2 text-xs font-bold text-[#5b4032]"
            >
              🖼️ Ürün Yönetimi
            </Link>
            <button
              onClick={() => setSoundOn((v) => !v)}
              className={`rounded-full border px-4 py-2 text-xs font-bold ${
                soundOn ? "border-[#ef2b1e] text-[#ef2b1e]" : "border-[#ccc] text-[#999]"
              }`}
            >
              {soundOn ? "🔔 Ses Açık" : "🔕 Ses Kapalı"}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-full border border-[#ccc] px-4 py-2 text-xs font-bold text-[#7a6f63]"
            >
              🚪 Çıkış
            </button>
          </div>
        </div>

        <div className="mx-auto mt-4 flex max-w-5xl gap-2">
          <button
            onClick={() => setTab("orders")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === "orders" ? "bg-[#231710] text-white" : "bg-[#eee7db] text-[#5b4032]"
            }`}
          >
            📋 Siparişler ({orders.length})
          </button>
          <button
            onClick={() => setTab("calls")}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === "calls" ? "bg-[#231710] text-white" : "bg-[#eee7db] text-[#5b4032]"
            }`}
          >
            🔔 Personel Çağrıları ({calls.length})
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pt-4 sm:px-8">
        <div className="rounded-2xl border border-[#e2ddd3] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black">🕐 Çalışma Saatleri</h3>
              <p className="text-xs text-[#7a6f63]">
                Kapalı saatlerde müşteriler "Şimdi" seçeneğini kullanamaz.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                onBlur={() => saveHoursSettings({ opening_time: openingTime })}
                className="rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm font-bold"
              />
              <span className="text-sm font-bold text-[#a18b7b]">—</span>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                onBlur={() => saveHoursSettings({ closing_time: closingTime })}
                className="rounded-xl border border-[#e5d4c2] px-3 py-2 text-sm font-bold"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["auto", "🕐 Otomatik (Saatlere Göre)"],
                ["force_open", "🟢 Zorla Açık"],
                ["force_closed", "🔴 Zorla Kapalı"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setManualStatus(value);
                  saveHoursSettings({ manual_status: value });
                }}
                disabled={hoursSaving}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${
                  manualStatus === value
                    ? "bg-[#231710] text-white"
                    : "border border-[#e5d4c2] text-[#5b4032]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {loading ? (
          <p className="text-center font-bold text-[#7a6f63]">Yükleniyor...</p>
        ) : tab === "orders" ? (
          orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d8cfc0] bg-white p-10 text-center font-bold text-[#7a6f63]">
              Bekleyen sipariş yok.
            </p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-[#e2ddd3] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#f3f1ed] px-2 py-1 text-xs font-black">
                          ID-{order.order_number}
                        </span>
                        <span className="text-xs font-bold text-[#7a6f63]">
                          {order.source === "delivery"
                            ? "🚚 Paket Sipariş"
                            : order.source === "pickup"
                              ? "🏃 Gel Al"
                              : order.source === "dinein"
                                ? "🍽️ Restoranda Yiyor"
                                : `🍽️ Masa ${order.restaurant_tables?.table_number ?? "?"}`}
                        </span>
                        <span className="text-xs text-[#a89d8e]">{timeAgo(order.created_at)}</span>
                        {order.source === "table" && order.is_takeaway && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                            📦 Al-Götür
                          </span>
                        )}
                      </div>
                      {(order.source === "delivery" ||
                        order.source === "pickup" ||
                        order.source === "dinein") && (
                        <div className="mt-1 text-sm text-[#5b4032]">
                          <div className="font-bold">{order.customer_name}</div>
                          <div>{order.customer_phone}</div>
                          {order.source === "delivery" && (
                            <>
                              <div className="text-xs text-[#7a6f63]">{order.delivery_address}</div>
                              {order.leave_at_reception && (
                                <div className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                                  🏨 Resepsiyona bırakılacak
                                </div>
                              )}
                              {order.delivery_note && (
                                <div className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs italic text-amber-800">
                                  📝 {order.delivery_note}
                                </div>
                              )}
                              {order.courier_fee_tl != null && (
                                <div className="mt-1 text-xs font-bold text-[#a05a2c]">
                                  🛵 Kurye: {order.courier_fee_tl.toLocaleString("tr-TR")} TL
                                  {order.delivery_distance_km != null &&
                                    ` (${order.delivery_distance_km} km)`}
                                </div>
                              )}
                              {order.delivery_lat != null && order.delivery_lng != null && (
                                <a
                                  href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-block text-xs font-bold text-blue-700 underline"
                                >
                                  📍 Haritada Gör
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {order.source === "table" && order.delivery_address && (
                        <div className="mt-1 text-xs italic text-[#7a6f63]">
                          Not: {order.delivery_address}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black">{order.total_tl.toLocaleString("tr-TR")} TL</div>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${
                          order.payment_status === "paid"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {order.payment_status === "paid" ? "Ödendi" : "Ödeme bekliyor"}
                      </span>
                      {order.source === "delivery" && order.payment_status === "paid" && (
                        <div className="mt-1">
                          {order.pushed_to_ikas ? (
                            <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                              ✅ ikas'a gönderildi
                            </span>
                          ) : order.ikas_push_error ? (
                            <span
                              className="inline-block cursor-help rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700"
                              title={order.ikas_push_error}
                            >
                              ⚠️ ikas hatası
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-600">
                              ⏳ ikas'a gönderiliyor
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5 border-t border-[#eee7db] pt-3 text-sm">
                    {order.order_items?.map((item) => (
                      <div key={item.id}>
                        <div className="flex justify-between">
                          <span>
                            {item.quantity}× {item.product_name_tr}
                          </span>
                          <span className="text-[#7a6f63]">
                            {(item.unit_price_tl * item.quantity).toLocaleString("tr-TR")} TL
                          </span>
                        </div>
                        {item.options && item.options.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {item.options.map((code) => (
                              <span
                                key={code}
                                className="rounded-lg bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-800"
                              >
                                {OPTION_LABELS[code]?.tr ?? code}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.dynamic_options && item.dynamic_options.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {item.dynamic_options.map((o, i) => (
                              <span
                                key={i}
                                className="rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800"
                              >
                                {o.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.item_note && (
                          <div className="mt-0.5 rounded-lg bg-amber-50 px-2 py-1 text-xs italic text-amber-800">
                            📝 {item.item_note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f3f1ed] px-3 py-1.5 text-xs font-black">
                      {ORDER_STATUS_LABEL[order.order_status] ?? order.order_status}
                    </span>
                    <button
                      onClick={() => yazdir(order)}
                      className="rounded-full border border-[#231710] px-4 py-1.5 text-xs font-bold text-[#231710]"
                    >
                      🖨️ Yazdır
                    </button>
                    {order.order_status !== "completed" && (
                      <button
                        onClick={() => advanceOrderStatus(order)}
                        className="rounded-full bg-[#231710] px-4 py-1.5 text-xs font-bold text-white"
                      >
                        Sonraki aşamaya geçir →
                      </button>
                    )}
                    {order.payment_status !== "paid" && (
                      <button
                        onClick={() => markPaid(order)}
                        className="rounded-full border border-green-600 px-4 py-1.5 text-xs font-bold text-green-700"
                      >
                        Ödendi olarak işaretle
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : calls.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#d8cfc0] bg-white p-10 text-center font-bold text-[#7a6f63]">
            Bekleyen çağrı yok.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {calls.map((call) => (
              <div key={call.id} className="rounded-2xl border border-[#e2ddd3] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black">
                    Masa {call.restaurant_tables?.table_number ?? "?"}
                  </span>
                  <span className="text-xs text-[#a89d8e]">{timeAgo(call.created_at)}</span>
                </div>
                <div className="mt-2 text-base font-bold">
                  {CALL_TYPE_LABEL[call.call_type] ?? call.call_type}
                </div>
                <button
                  onClick={() => resolveCall(call)}
                  className="mt-4 w-full rounded-2xl bg-[#231710] py-2.5 text-sm font-black text-white"
                >
                  ✅ Hallettim
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>

    {/* Mutfak fişi yazdırma alanı — ekranda hiç görünmez, sadece
        yazdırmada belirir. Kağıt boyutu, fiş yazıcısıyla aynı: 102x152mm. */}
    {printingOrder && (
      <div id="mutfak-fisi-yazdirma" style={{ display: "none" }}>
        <style>{`
          @media print {
            .ekran-icerigi { display: none !important; }
            #mutfak-fisi-yazdirma { display: block !important; }
            @page { size: 102mm 152mm; margin: 5mm; }
          }
        `}</style>
        <MutfakFisi order={printingOrder} />
      </div>
    )}
    </>
  );
}
