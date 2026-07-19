"use client";

import { useEffect, useMemo } from "react";
import L, { type LatLngExpression } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { money } from "@/lib/utils";
import type { House } from "@/types";

export type LatLng = {
  lat: number;
  lng: number;
};

const defaultCenter: LatLng = { lat: -4.325, lng: 15.322 };

function markerIcon(tone = "#0891b2") {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:999px;background:${tone};color:white;box-shadow:0 12px 24px rgba(15,23,42,.25);border:4px solid white;"><span style="width:10px;height:10px;border-radius:999px;background:white;"></span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function toneForStatus(status: House["status"]) {
  if (status === "Disponible") return "#059669";
  if (status === "Archivé") return "#64748b";
  return "#d97706";
}

function ClickToPick({ onChange }: { onChange: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });
  return null;
}

function RecenterMap({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, map, zoom]);
  return null;
}

export function LeafletLocationPicker({
  value,
  suggestedCenter,
  onChange
}: {
  value: LatLng | null;
  suggestedCenter?: LatLng;
  onChange: (point: LatLng) => void;
}) {
  const center = value || suggestedCenter || defaultCenter;
  const zoom = value ? 16 : suggestedCenter ? 14 : 12;

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom className="h-[280px] w-full rounded-2xl min-[390px]:h-[320px] sm:h-[360px]">
      <RecenterMap center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPick onChange={onChange} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={markerIcon()}
          draggable
          eventHandlers={{
            dragend(event) {
              const marker = event.target as L.Marker;
              const point = marker.getLatLng();
              onChange({ lat: point.lat, lng: point.lng });
            }
          }}
        >
          <Popup>Point exact du bien</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}

export function LeafletHousesMap({ houses, getHouseHref }: { houses: House[]; getHouseHref?: (house: House) => string }) {
  const housesWithCoords = houses.filter((house): house is House & { latitude: number; longitude: number } =>
    typeof house.latitude === "number" &&
    typeof house.longitude === "number" &&
    Number.isFinite(house.latitude) &&
    Number.isFinite(house.longitude)
  );

  const center = useMemo<LatLngExpression>(() => {
    if (!housesWithCoords.length) return [defaultCenter.lat, defaultCenter.lng];
    const lat = housesWithCoords.reduce((sum, house) => sum + house.latitude, 0) / housesWithCoords.length;
    const lng = housesWithCoords.reduce((sum, house) => sum + house.longitude, 0) / housesWithCoords.length;
    return [lat, lng];
  }, [housesWithCoords]);

  return (
    <MapContainer center={center} zoom={housesWithCoords.length ? 12 : 11} scrollWheelZoom className="h-[300px] w-full rounded-2xl min-[390px]:h-[360px] md:h-[420px]">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {housesWithCoords.map(house => (
        <Marker key={house.id} position={[house.latitude, house.longitude]} icon={markerIcon(toneForStatus(house.status))}>
          <Popup>
            <div className="w-44 max-w-full sm:w-48">
              <p className="font-bold">{house.title}</p>
              <p>{house.district ? `${house.district}, ` : ""}{house.commune}, {house.city}</p>
              <p>{money(house.price)}</p>
              {getHouseHref && <a href={getHouseHref(house)} className="mt-2 inline-block font-bold text-brand-700">Ouvrir le detail</a>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
