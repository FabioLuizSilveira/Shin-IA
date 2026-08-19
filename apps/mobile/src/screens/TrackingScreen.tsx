import { useCallback, useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../theme";
import { ScreenHeader } from "../components/ui";
import { AsyncScreen } from "../components/async-screen";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia } from "../lib/shinaia-api";

// Mobile equivalent of tenant/tracking's fleet map. There's no native map
// SDK wired into this app (react-native-maps needs a Google Maps API key on
// Android that this project doesn't have) — a WebView rendering Leaflet
// against free OpenStreetMap tiles gets a real map with zero API keys,
// mirroring exactly what the web tracking page already renders.
function buildMapHtml(
  points: { id: string; name: string; lat: number; lng: number; status: string | null }[],
): string {
  const center =
    points.length > 0
      ? [
          points.reduce((s, p) => s + p.lat, 0) / points.length,
          points.reduce((s, p) => s + p.lng, 0) / points.length,
        ]
      : [-23.5505, -46.6333];

  const markers = points
    .map(
      (p) =>
        `L.marker([${p.lat}, ${p.lng}]).addTo(map).bindPopup(${JSON.stringify(
          `<b>${p.name}</b><br/>${p.status ?? ""}`,
        )});`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html, body, #map { height: 100%; margin: 0; padding: 0; background: ${theme.colors.surface}; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([${center[0]}, ${center[1]}], ${points.length > 0 ? 12 : 11});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    ${markers}
  </script>
</body>
</html>`;
}

export function TrackingScreen() {
  const fetcher = useCallback(() => shinaia.fleetLocations(), []);
  const { state, refreshing, reload } = useAsyncData(fetcher);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScreenHeader title="Rastreamento" subtitle="Mapa da Frota" brand />
      <AsyncScreen
        state={state}
        refreshing={refreshing}
        onRetry={() => void reload(true)}
        emptyTitle="Nenhuma localização"
        emptySubtitle="Nenhum veículo reportou posição ainda."
      >
        {(locations: Awaited<ReturnType<typeof shinaia.fleetLocations>>["data"]) => (
          <FleetMap locations={locations} />
        )}
      </AsyncScreen>
    </View>
  );
}

function FleetMap({
  locations,
}: {
  locations: {
    resource_id: string;
    resource_name: string | null;
    resource_type: string | null;
    resource_status: string | null;
    latitude: number;
    longitude: number;
    recorded_at: string;
  }[];
}) {
  const html = useMemo(
    () =>
      buildMapHtml(
        locations.map((l) => ({
          id: l.resource_id,
          name: l.resource_name ?? "Veículo",
          lat: l.latitude,
          lng: l.longitude,
          status: l.resource_status,
        })),
      ),
    [locations],
  );

  return (
    <View style={styles.mapContainer}>
      <WebView originWhitelist={["*"]} source={{ html }} style={styles.map} />
    </View>
  );
}

// AsyncScreen wraps children in a ScrollView, which never gives a nested
// flex:1 child a real height — a fixed height (screen minus header/tab bar,
// roughly) is required for the WebView to actually render anything.
const MAP_HEIGHT = Dimensions.get("window").height * 0.72;

const styles = StyleSheet.create({
  mapContainer: { height: MAP_HEIGHT },
  map: { flex: 1 },
});
