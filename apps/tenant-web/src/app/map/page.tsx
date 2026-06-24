"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/layout/app-shell";
import { Navigation, Wifi, WifiOff, RefreshCw, Layers, MapPin } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DeviceMarker {
  deviceId: string;
  resourceId?: string | null;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  receivedAt: string;
}

interface TrackingBroadcast {
  deviceId: string;
  resourceId?: string | null;
  tenantId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  receivedAt: string;
}

// ── Map component (dynamic import avoids SSR issue with Leaflet) ───────────────

function FleetMap({
  markers,
  onMarkerClick,
}: {
  markers: DeviceMarker[];
  onMarkerClick: (m: DeviceMarker) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMap = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMarkers = useRef<Map<string, any>>(new Map());

  // Init map once
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Dynamically import Leaflet (SSR-safe)
    void import("leaflet").then((L) => {
      // @ts-ignore: leaflet css via link tag
      if (!document.querySelector("#leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = L.map(mapRef.current!, {
        center: [-15.7801, -47.9292], // Brazil center
        zoom: 5,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      leafletMap.current = map;
    });

    return () => {
      if (leafletMap.current) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Update markers on change
  useEffect(() => {
    if (!leafletMap.current) return;

    void import("leaflet").then((L) => {
      const existing = new Set(leafletMarkers.current.keys());

      for (const m of markers) {
        const existingMarker = leafletMarkers.current.get(m.deviceId);

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
            background: ${m.speed > 0 ? "#2563eb" : "#64748b"};
            border: 2px solid white;
            transform: rotate(${m.heading - 45}deg);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const popup = `
          <div style="font-family:system-ui;min-width:160px">
            <p style="font-weight:600;margin:0 0 4px">${m.resourceId ?? m.deviceId.slice(0, 8)}</p>
            <p style="margin:0;color:#64748b;font-size:12px">
              Velocidade: <strong>${m.speed} km/h</strong><br/>
              Última atualização: ${new Date(m.receivedAt).toLocaleTimeString("pt-BR")}
            </p>
          </div>
        `;

        if (existingMarker) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          existingMarker.setLatLng([m.lat, m.lng]);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          existingMarker.setIcon(icon);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          existingMarker.getPopup()?.setContent(popup);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const marker = L.marker([m.lat, m.lng], { icon })
            .addTo(leafletMap.current)
            .bindPopup(popup)
            .on("click", () => onMarkerClick(m));
          leafletMarkers.current.set(m.deviceId, marker);
        }
        existing.delete(m.deviceId);
      }

      // Remove stale markers
      for (const id of existing) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        leafletMarkers.current.get(id)?.remove();
        leafletMarkers.current.delete(id);
      }

      // Fit bounds if markers exist and this is first load
      if (markers.length > 0 && leafletMarkers.current.size === markers.length) {
        try {
          const bounds = markers.map((m) => [m.lat, m.lng] as [number, number]);
          leafletMap.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        } catch {
          // ignore
        }
      }
    });
  }, [markers, onMarkerClick]);

  return <div ref={mapRef} className="w-full h-full rounded-xl overflow-hidden" />;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MapPage() {
  const [markers, setMarkers] = useState<DeviceMarker[]>([]);
  const [selected, setSelected] = useState<DeviceMarker | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [deviceCount, setDeviceCount] = useState(0);

  const updateMarker = useCallback((data: TrackingBroadcast) => {
    setMarkers((prev) => {
      const idx = prev.findIndex((m) => m.deviceId === data.deviceId);
      const updated: DeviceMarker = {
        deviceId: data.deviceId,
        resourceId: data.resourceId,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        heading: data.heading,
        receivedAt: data.receivedAt,
      };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
    setLastUpdate(new Date());
  }, []);

  // Load initial positions from DB
  useEffect(() => {
    async function loadLatest() {
      const res = await fetch("/api/tracking/devices");
      const json = (await res.json()) as {
        data?: Array<{ id: string; resource_id: string | null }>;
      };
      setDeviceCount(json.data?.length ?? 0);
    }
    void loadLatest();
  }, []);

  // Subscribe to Realtime
  useEffect(() => {
    const supabase = createClient();

    // Get tenant_id from session
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const tenantId = user.app_metadata?.tenant_id as string | undefined;
      if (!tenantId) return;

      const channel = supabase
        .channel(`tracking:${tenantId}`)
        .on("broadcast", { event: "position" }, ({ payload }) => {
          updateMarker(payload as TrackingBroadcast);
        })
        .subscribe((status) => {
          setConnected(status === "SUBSCRIBED");
        });

      return () => {
        void supabase.removeChannel(channel);
      };
    });
  }, [updateMarker]);

  const onlineCount = markers.filter((m) => m.speed > 0).length;

  return (
    <AppShell title="Mapa da Frota">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          {
            label: "Dispositivos",
            value: deviceCount,
            icon: MapPin,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Em movimento",
            value: onlineCount,
            icon: Navigation,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Parados",
            value: markers.length - onlineCount,
            icon: MapPin,
            color: "text-amber-600 bg-amber-50",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
            >
              <div
                className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center shrink-0`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map + sidebar */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
        {/* Map */}
        <div className="flex-1 relative">
          <FleetMap markers={markers} onMarkerClick={setSelected} />

          {/* Realtime status */}
          <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full border border-slate-200 text-xs font-medium shadow-sm">
            {connected ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span className="text-green-700">Ao vivo</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-slate-400" />
                <span className="text-slate-500">Conectando...</span>
              </>
            )}
          </div>

          {/* Last update */}
          {lastUpdate && (
            <div className="absolute bottom-3 left-3 z-[1000] px-2.5 py-1 bg-white/90 backdrop-blur rounded-lg text-xs text-slate-500 shadow-sm border border-slate-200">
              <RefreshCw className="w-2.5 h-2.5 inline mr-1" />
              {lastUpdate.toLocaleTimeString("pt-BR")}
            </div>
          )}

          {/* Empty state */}
          {markers.length === 0 && (
            <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none">
              <div className="bg-white/95 backdrop-blur rounded-2xl p-6 text-center shadow-lg border border-slate-200 max-w-xs">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  Nenhum veículo rastreado
                </p>
                <p className="text-xs text-slate-400">
                  Provisione dispositivos GPS e envie posições para a Edge Function{" "}
                  <code className="text-blue-600">ingest-position</code>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Selected device panel */}
        {selected && (
          <div className="w-64 bg-white rounded-xl border border-slate-200 p-5 shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Veículo</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "ID do dispositivo", value: selected.deviceId.slice(0, 8).toUpperCase() },
                { label: "Recurso", value: selected.resourceId ?? "Não vinculado" },
                { label: "Velocidade", value: `${selected.speed} km/h` },
                { label: "Direção", value: `${selected.heading}°` },
                { label: "Latitude", value: selected.lat.toFixed(6) },
                { label: "Longitude", value: selected.lng.toFixed(6) },
                {
                  label: "Última posição",
                  value: new Date(selected.receivedAt).toLocaleString("pt-BR"),
                },
              ].map((row) => (
                <div key={row.label}>
                  <p className="text-xs text-slate-400">{row.label}</p>
                  <p className="text-sm font-medium text-slate-900 font-mono">{row.value}</p>
                </div>
              ))}
            </div>
            <a
              href={`/api/tracking/history?deviceId=${selected.deviceId}&limit=100`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block w-full text-center text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg py-2 transition"
            >
              Ver histórico de posições
            </a>
          </div>
        )}
      </div>
    </AppShell>
  );
}
