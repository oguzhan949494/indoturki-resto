"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

let scriptLoadingPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const callbackName = "__googleMapsInitCallback";
    (window as any)[callbackName] = () => resolve();

    const script = document.createElement("script");
    // Not: "loading=async" parametresini kasıtlı kullanmıyoruz - o parametre
    // yeni importLibrary() akışı için tasarlanmış ve klasik
    // google.maps.places.Autocomplete ile birlikte kullanılınca "places"
    // kütüphanesi tam yüklenmeden script "hazır" görünüyor, bu da
    // "Cannot read properties of undefined (reading 'Autocomplete')" hatasına
    // yol açıyordu. callback parametresi, places dahil her şey gerçekten
    // hazır olduğunda tetikleniyor, bu yüzden güvenilir.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps script yüklenemedi."));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

// Google Maps + Places kütüphanesini bir kere yükler, sayfalar arası tekrar
// yüklemez. `loaded` true olmadan window.google.maps kullanılmamalı.
export function useGoogleMaps() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps API anahtarı tanımlı değil.");
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => setLoaded(true))
      .catch(() => setError("Harita yüklenemedi."));
  }, []);

  return { loaded, error };
}
