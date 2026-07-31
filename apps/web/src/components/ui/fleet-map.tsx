"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icons reference image URLs that break under
// bundlers unless re-pointed at CDN assets explicitly.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface FleetMapPoint {
  resource_id: string;
  resource_name: string | null;
  resource_type: string | null;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface FleetMapProps {
  points: FleetMapPoint[];
}

const DEFAULT_CENTER: [number, number] = [-14.235, -51.9253]; // Brazil, roughly

export function FleetMap({ points }: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (points.length === 0) return;

    points.forEach((p) => {
      L.marker([p.latitude, p.longitude])
        .bindPopup(
          `<strong>${p.resource_name ?? "Recurso"}</strong><br/>${p.resource_type ?? ""}<br/>${new Date(p.recorded_at).toLocaleString("pt-BR")}`,
        )
        .addTo(layer);
    });

    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [points]);

  return <div ref={containerRef} className="w-full h-full rounded-xl" />;
}
