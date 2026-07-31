import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchMyRentals, type Rental } from "../lib/rentals";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "RentalsList">;

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  draft: "Rascunho",
  expired: "Expirado",
  terminated: "Encerrado",
  suspended: "Suspenso",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function RentalsListScreen({ navigation }: Props) {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchMyRentals()
      .then(setRentals)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={rentals}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={rentals.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>Nenhuma locação encontrada.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("RentalDetail", { rentalId: item.id })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {item.contract_assets[0]?.assets?.name ?? "Locação"}
                {item.contract_assets.length > 1 ? ` +${item.contract_assets.length - 1}` : ""}
              </Text>
              <Text style={styles.cardStatus}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
            <Text style={styles.cardDates}>
              {formatDate(item.period_starts_at)} — {formatDate(item.period_ends_at)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#94A3B8", fontSize: 14 },
  error: { color: "#DC2626", padding: 16, fontSize: 13 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#0F172A", flexShrink: 1 },
  cardStatus: { fontSize: 12, fontWeight: "600", color: "#2563EB" },
  cardDates: { fontSize: 13, color: "#64748B", marginTop: 6 },
});
