import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const lat = body?.lat as number | undefined;
    const lng = body?.lng as number | undefined;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "Konum bilgisi eksik." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase ortam değişkenleri eksik." }, { status: 500 });
    }
    if (!mapsApiKey) {
      return NextResponse.json(
        { error: "Google Maps API anahtarı .env.local dosyasında tanımlı değil." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: settings, error: settingsError } = await supabase
      .from("restaurant_settings")
      .select("restaurant_lat, restaurant_lng, courier_base_fee, courier_per_km_fee")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings) {
      return NextResponse.json({ error: "Restoran ayarları alınamadı." }, { status: 500 });
    }

    const { restaurant_lat, restaurant_lng, courier_base_fee, courier_per_km_fee } = settings;

    if (restaurant_lat == null || restaurant_lng == null) {
      return NextResponse.json(
        {
          error:
            "Restoranın konumu henüz ayarlanmamış. Supabase'de restaurant_settings tablosuna restaurant_lat / restaurant_lng ekleyin.",
        },
        { status: 500 }
      );
    }

    const origins = `${restaurant_lat},${restaurant_lng}`;
    const destinations = `${lat},${lng}`;

    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${encodeURIComponent(origins)}` +
      `&destinations=${encodeURIComponent(destinations)}` +
      `&mode=driving&units=metric&key=${mapsApiKey}`;

    const googleRes = await fetch(url);
    const googleData = await googleRes.json();

    const element = googleData?.rows?.[0]?.elements?.[0];

    if (googleData.status !== "OK" || !element || element.status !== "OK") {
      console.error("Distance Matrix hatası:", googleData);
      return NextResponse.json(
        { error: "Mesafe hesaplanamadı. Adresi kontrol edip tekrar deneyin." },
        { status: 400 }
      );
    }

    const distanceMeters = element.distance.value as number;
    const distanceKm = distanceMeters / 1000;

    const baseFee = Number(courier_base_fee) || 0;
    const perKmFee = Number(courier_per_km_fee) || 0;
    const feeTl = Math.round(baseFee + perKmFee * distanceKm);

    return NextResponse.json({
      feeTl,
      distanceKm: Math.round(distanceKm * 10) / 10,
      distanceText: element.distance.text,
      durationText: element.duration.text,
    });
  } catch (error) {
    console.error("DELIVERY-FEE HATASI:", error);
    return NextResponse.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
  }
}
