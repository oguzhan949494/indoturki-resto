// Restoranın açık/kapalı olup olmadığını hesaplayan paylaşılan mantık.
// Hem paket servis hem masa sayfası hem admin panelinde kullanılıyor.

export type RestaurantHoursSettings = {
  opening_time: string; // "HH:MM" ya da "HH:MM:SS"
  closing_time: string;
  manual_status: "auto" | "force_open" | "force_closed";
};

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function isRestaurantOpen(settings: RestaurantHoursSettings | null): boolean {
  // Ayar hiç yoksa (veri çekilemedi vb.) siteyi kilitlememek için açık kabul ediyoruz.
  if (!settings) return true;
  if (settings.manual_status === "force_open") return true;
  if (settings.manual_status === "force_closed") return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = timeToMinutes(settings.opening_time);
  const closeMinutes = timeToMinutes(settings.closing_time);

  if (openMinutes === closeMinutes) return true; // aynı saat girildiyse 24 saat açık say

  if (openMinutes < closeMinutes) {
    // Normal aralık (örn. 10:00 - 22:00)
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }
  // Gece yarısını geçen aralık (örn. 18:00 - 02:00)
  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}
