import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, GradientButton, EmptyState } from "../components/ui";
import { HOTLINK_HEADERS } from "../lib/image-headers";
import {
  fetchMyRentals,
  fetchMyInvoices,
  fetchMyRentalCustomerId,
  fetchUpgradeOptions,
  createRenewalRequest,
  type Rental,
  type CustomerInvoice,
  type UpgradeOption,
} from "../lib/rentals";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Renewal">;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

// "Renovar contrato" — shows the current rental, the tenant's available
// fleet at the same price or higher (assets_select_rental_customer_catalog,
// 20260090000000), and a payment summary, then submits a renewal request
// for the chosen vehicle. There is no live payment gateway behind this yet
// (Fase G: billing is registro/controle only) — submitting turns into a
// real service request staff processes into an actual renewed contract +
// invoice, same mechanism as the existing "Pedir prorrogação" flow.
export function RenewalScreen({ route, navigation }: Props) {
  const { rentalId } = route.params;
  const [rental, setRental] = useState<Rental | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchMyRentals()
      .then(async (rentals) => {
        const r = rentals.find((x) => x.id === rentalId) ?? null;
        setRental(r);
        const currentRate = r?.contract_assets[0]?.assets ? Number(r.value_amount) : 0;
        const [opts, inv] = await Promise.all([
          r ? fetchUpgradeOptions(r.tenant_id, currentRate) : Promise.resolve([]),
          fetchMyInvoices(),
        ]);
        setOptions(opts);
        setInvoices(inv);
        setSelectedId(r?.contract_assets[0]?.assets?.id ?? opts[0]?.id ?? null);
      })
      .catch((err: Error) => Alert.alert("Erro", err.message))
      .finally(() => setLoading(false));
  }, [rentalId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleConfirm() {
    if (!rental || !selectedId) return;
    const chosen = options.find((o) => o.id === selectedId);
    const chosenName = chosen?.name ?? rental.contract_assets[0]?.assets?.name ?? "veículo atual";
    const weeklyRate = chosen?.metadata.weekly_rate ?? Number(rental.value_amount);
    setSubmitting(true);
    try {
      const rentalCustomerId = await fetchMyRentalCustomerId();
      await createRenewalRequest({
        tenantContractId: rental.id,
        rentalCustomerId,
        tenantId: rental.tenant_id,
        chosenAssetName: chosenName,
        weeklyRate,
      });
      Alert.alert("Solicitado", "Seu pedido de renovação foi enviado ao locador.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao solicitar renovação");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !rental) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loader />
      </View>
    );
  }

  const pending = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const pendingTotal = pending.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const currency = invoices[0]?.total_currency ?? rental.value_currency;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <BackHeader title="Renovar contrato" />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Card>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>LOCAÇÃO ATUAL</Text>
          <Text style={[T.display(theme.font.lg), { marginTop: theme.spacing.xs }]}>
            {rental.contract_assets[0]?.assets?.name ?? "Locação"}
          </Text>
          <Text style={T.text(theme.font.sm)}>
            {formatCurrency(Number(rental.value_amount), rental.value_currency)}/semana
          </Text>
        </Card>

        <Card>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>PAGAMENTO</Text>
          <Text style={[T.display(theme.font.xl), { marginTop: theme.spacing.xs }]}>
            {formatCurrency(pendingTotal, currency)}
          </Text>
          <Text style={T.text(theme.font.sm)}>
            {pending.length > 0
              ? `${pending.length} fatura(s) pendente(s) — quitar antes de renovar é recomendado`
              : "Nenhuma pendência — pronto para renovar"}
          </Text>
        </Card>

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={T.display(theme.font.lg)}>Veículos disponíveis</Text>
          <Text style={T.text(theme.font.sm)}>
            Mesmo valor ou superior ao seu plano atual — escolha para renovar ou fazer upgrade.
          </Text>

          {options.length === 0 ? (
            <EmptyState
              icon="car-outline"
              title="Nenhum veículo disponível"
              subtitle="No momento não há opções de igual ou maior valor disponíveis."
            />
          ) : (
            options.map((opt) => {
              const selected = opt.id === selectedId;
              return (
                <Pressable key={opt.id} onPress={() => setSelectedId(opt.id)}>
                  <Card
                    style={{
                      flexDirection: "row",
                      gap: theme.spacing.md,
                      alignItems: "center",
                      borderColor: selected ? theme.colors.brandSecondary : theme.colors.border,
                      borderWidth: selected ? 2 : 1,
                    }}
                  >
                    {opt.metadata.photo_url ? (
                      <Image
                        source={{ uri: opt.metadata.photo_url, headers: HOTLINK_HEADERS }}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: theme.radius.md,
                          backgroundColor: theme.colors.surfaceTertiary,
                        }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: theme.radius.md,
                          backgroundColor: theme.colors.surfaceTertiary,
                        }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={T.display(theme.font.base)}>{opt.name}</Text>
                      <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
                        {formatCurrency(opt.metadata.weekly_rate ?? 0, currency)}/semana
                      </Text>
                    </View>
                    {selected && <Chip status="active" label="Selecionado" />}
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>

        <GradientButton
          label={submitting ? "Enviando..." : "Confirmar renovação"}
          onPress={() => void handleConfirm()}
          loading={submitting}
        />
      </View>
    </ScrollView>
  );
}
