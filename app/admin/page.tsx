"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type OrderItemRow = {
  id: string;
  product_name_tr: string;
  quantity: number;
  unit_price_tl: number;
  item_note: string | null;
};

type OrderRow = {
  id: string;
  order_number: number;
  source: "delivery" | "table";
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
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

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "calls">("orders");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [calls, setCalls] = useState<StaffCallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, source, table_id, customer_name, customer_phone, delivery_address, total_tl, sambal_requested, order_status, payment_status, created_at, order_items(id, product_name_tr, quantity, unit_price_tl, item_note), restaurant_tables(table_number)"
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

  const playPing = useCallback(() => {
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

  useEffect(() => {
    setLoading(true);
    Promise.all([loadOrders(), loadCalls()]).finally(() => setLoading(false));

    const ordersChannel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          playPing();
          loadOrders();
        }
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
        { event: "*", schema: "public", table: "staff_calls" },
        () => {
          playPing();
          loadCalls();
        }
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

  const markPaid = async (order: OrderRow) => {
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", order.id);
    if (error) console.error(error);
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
    <main className="min-h-screen bg-[#f3f1ed] text-[#231710]">
      <header className="sticky top-0 z-20 border-b border-[#e2ddd3] bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Indoturki Resto — Yönetici Paneli</h1>
            <p className="text-xs text-[#7a6f63]">Canlı sipariş ve personel çağrı takibi</p>
          </div>
          <div className="flex items-center gap-2">
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
                            : `🍽️ Masa ${order.restaurant_tables?.table_number ?? "?"}`}
                        </span>
                        <span className="text-xs text-[#a89d8e]">{timeAgo(order.created_at)}</span>
                      </div>
                      {order.source === "delivery" && (
                        <div className="mt-1 text-sm text-[#5b4032]">
                          <div className="font-bold">{order.customer_name}</div>
                          <div>{order.customer_phone}</div>
                          <div className="text-xs text-[#7a6f63]">{order.delivery_address}</div>
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
                        {item.item_note && (
                          <div className="mt-0.5 rounded-lg bg-amber-50 px-2 py-1 text-xs italic text-amber-800">
                            📝 {item.item_note}
                          </div>
                        )}
                      </div>
                    ))}
                    {order.sambal_requested && (
                      <div className="text-xs text-[#a05a2c]">🌶️ Sambal isteniyor</div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f3f1ed] px-3 py-1.5 text-xs font-black">
                      {ORDER_STATUS_LABEL[order.order_status] ?? order.order_status}
                    </span>
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
  );
}
