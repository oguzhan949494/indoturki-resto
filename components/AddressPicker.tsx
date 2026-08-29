"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "@/utils/google-maps";

type Props = {
  address: string;
  onAddressChange: (address: string) => void;
  onLocationChange: (lat: number, lng: number) => void;
  placeholder: string;
  dragHint: string;
};

export default function AddressPicker({
  address,
  onAddressChange,
  onLocationChange,
  placeholder,
  dragHint,
}: Props) {
  const { loaded, error } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [showMap, setShowMap] = useState(false);
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded || !inputRef.current || !window.google) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry"],
      componentRestrictions: { country: "tr" },
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const formatted = place.formatted_address || inputRef.current?.value || "";
      onAddressChange(formatted);
      onLocationChange(lat, lng);
      setPinLat(lat);
      setPinLng(lng);
      setShowMap(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Harita kutusu (mapDivRef) ancak showMap true olduktan SONRA DOM'a eklenir.
  // Bu yüzden haritayı, kutu gerçekten var olduktan sonra (bu effect ile) kuruyoruz.
  useEffect(() => {
    if (!showMap || pinLat == null || pinLng == null || !mapDivRef.current || !window.google) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(mapDivRef.current, {
        center: { lat: pinLat, lng: pinLng },
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
      });
      markerRef.current = new window.google.maps.Marker({
        position: { lat: pinLat, lng: pinLng },
        map: mapRef.current,
        draggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const pos = markerRef.current.getPosition();
        onLocationChange(pos.lat(), pos.lng());
      });
    } else {
      mapRef.current.setCenter({ lat: pinLat, lng: pinLng });
      markerRef.current.setPosition({ lat: pinLat, lng: pinLng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, pinLat, pinLng]);

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        required
        value={address}
        onChange={(event) => onAddressChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#e5d4c2] bg-white px-4 py-3 outline-none focus:border-[#ef2b1e]"
      />
      {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
      {showMap && (
        <div className="mt-2">
          <div
            ref={mapDivRef}
            className="h-48 w-full overflow-hidden rounded-2xl border border-[#e5d4c2]"
          />
          <p className="mt-1 text-[11px] text-[#a18b7b]">{dragHint}</p>
        </div>
      )}
    </div>
  );
}
