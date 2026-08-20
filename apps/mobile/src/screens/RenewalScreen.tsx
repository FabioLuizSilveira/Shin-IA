import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Calendar, type DateData } from "react-native-calendars";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, GradientButton, EmptyState } from "../components/ui";
import { HOTLINK_HEADERS } from "../lib/image-headers";
import {
  fetchMyRentals,
  fetchMyInvoices,
  fetchUpgradeOptions,
  fetchMyReservations,
  type Rental,
  type CustomerInvoice,
  type UpgradeOption,
  type Reservation,
} from "../lib/rentals";
import { shinaia, ApiError } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Renewal">;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10);
}

function eachDateInRange(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const cur = new Date(startIso);
  const end = new Date(endIso);
  while (cur < end) {
    out.push(toDateString(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const RESERVATION_STATUS_LABEL: Record<string, string> = {
  pending_deposit: "Aguardando sinal",
  reserved: "Reservado — saldo pendente",
  completed: "Confirmado",
  forfeited: "Sinal perdido",
  cancelled: "Cancelado",
};

// "Renovar contrato": same car = pay to renew, no calendar needed — the
// Stripe webhook (action: "renewal") extends the existing contract the
// moment payment clears. A different (equal-or-higher) car = a real
// booking: pick dates on the calendar, pay a 20% deposit to hold the
// period (webhook action: "deposit"), pay the 80% balance any time before
// the day it starts or the cron job (api/cron/forfeit-reservations) marks
// it forfeited and the deposit is kept.
export function RenewalScreen({ route, navigation }: Props) {
  const { rentalId } = route.params;
  const [rental, setRental] = useState<Rental | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [options, setOptions] = useState<UpgradeOption[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const currentAssetId = rental?.contract_assets[0]?.assets?.id ?? null;

  const load = useCallback(() => {
    setLoading(true);
    fetchMyRentals()
      .then(async (rentals) => {
        const r = rentals.find((x) => x.id === rentalId) ?? null;
        setRental(r);
        const currentRate = Number(r?.value_amount ?? 0);
        const [opts, inv, res] = await Promise.all([
          r ? fetchUpgradeOptions(r.tenant_id, currentRate) : Promise.resolve([]),
          fetchMyInvoices(),
          fetchMyReservations(),
        ]);
        setOptions(opts);
        setInvoices(inv);
        setReservations(res.filter((x) => x.tenant_id === r?.tenant_id));
        setSelectedId(r?.contract_assets[0]?.assets?.id ?? null);
      })
      .catch((err: Error) => Alert.alert("Erro", err.message))
      .finally(() => setLoading(false));
  }, [rentalId]);

  useFocusEffect(
    useCallback(() => {
      load();
      setRangeStart(null);
      setRangeEnd(null);
    }, [load]),
  );

  const loadAvailability = useCallback(async (assetId: string) => {
    try {
      const { data: ranges } = await shinaia.customerAssetAvailability(assetId);
      const days = new Set<string>();
      ranges.forEach((r) => eachDateInRange(r.start, r.end).forEach((d) => days.add(d)));
      setBookedDates(days);
    } catch {
      setBookedDates(new Set());
    }
  }, []);

  function selectOption(id: string) {
    setSelectedId(id);
    setRangeStart(null);
    setRangeEnd(null);
    if (id !== currentAssetId) void loadAvailability(id);
  }

  function onDayPress(day: DateData) {
    if (bookedDates.has(day.dateString)) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day.dateString);
      setRangeEnd(null);
      return;
    }
    if (day.dateString <= rangeStart) {
      setRangeStart(day.dateString);
      return;
    }
    // Reject a range that crosses a booked day.
    const spanned = eachDateInRange(rangeStart, day.dateString);
    if (spanned.some((d) => bookedDates.has(d))) {
      Alert.alert("Período indisponível", "Esse intervalo passa por dias já reservados.");
      return;
    }
    setRangeEnd(day.dateString);
  }

  const markedDates = useMemo(() => {
    const marks: Record<string, unknown> = {};
    bookedDates.forEach((d) => {
      marks[d] = { disabled: true, disableTouchEvent: true, textColor: theme.colors.muted };
    });
    if (rangeStart && rangeEnd) {
      eachDateInRange(
        rangeStart,
        toDateString(new Date(new Date(rangeEnd).getTime() + 86400000)),
      ).forEach((d, i, arr) => {
        marks[d] = {
          color: theme.colors.brandSecondary,
          textColor: "#fff",
          startingDay: i === 0,
          endingDay: i === arr.length - 1,
        };
      });
    } else if (rangeStart) {
      marks[rangeStart] = {
        color: theme.colors.brandSecondary,
        textColor: "#fff",
        startingDay: true,
        endingDay: true,
      };
    }
    return marks;
  }, [bookedDates, rangeStart, rangeEnd]);

  const selectedOption = options.find((o) => o.id === selectedId);
  const isSameCar = selectedId === currentAssetId;
  const weeklyRate = isSameCar
    ? Number(rental?.value_amount ?? 0)
    : Number(selectedOption?.metadata.weekly_rate ?? 0);

  const weeks =
    rangeStart && rangeEnd
      ? Math.max(
          1,
          Math.ceil((new Date(rangeEnd).getTime() - new Date(rangeStart).getTime()) / 604800000),
        )
      : 0;
  const previewTotal = weeklyRate * weeks;
  const previewDeposit = Math.round(previewTotal * 0.2 * 100) / 100;
  const previewBalance = Math.round((previewTotal - previewDeposit) * 100) / 100;

  async function openCheckout(url: string) {
    setSubmitting(true);
    try {
      await WebBrowser.openBrowserAsync(url);
    } finally {
      setSubmitting(false);
      load();
    }
  }

  async function handleRenewSameCar() {
    if (!rental) return;
    setSubmitting(true);
    try {
      const { url } = await shinaia.customerRenewalCheckout(rental.id);
      await openCheckout(url);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Falha ao iniciar pagamento");
      setSubmitting(false);
    }
  }

  async function handleReserveDifferentCar() {
    if (!selectedId || !rangeStart || !rangeEnd) {
      Alert.alert("Escolha as datas", "Selecione o período no calendário primeiro.");
      return;
    }
    setSubmitting(true);
    try {
      const { url } = await shinaia.customerCreateReservation({
        assetId: selectedId,
        startsAt: new Date(rangeStart).toISOString(),
        endsAt: new Date(new Date(rangeEnd).getTime() + 86400000).toISOString(),
      });
      await openCheckout(url);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Falha ao criar reserva");
      setSubmitting(false);
    }
  }

  async function handlePayBalance(reservationId: string) {
    setSubmitting(true);
    try {
      const { url } = await shinaia.customerReservationBalanceCheckout(reservationId);
      await openCheckout(url);
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Falha ao iniciar pagamento");
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

        <Pressable onPress={() => navigation.navigate("CustomerInvoices")}>
          <Card>
            <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>PAGAMENTO</Text>
            <Text style={[T.display(theme.font.xl), { marginTop: theme.spacing.xs }]}>
              {formatCurrency(pendingTotal, currency)}
            </Text>
            <Text style={T.text(theme.font.sm)}>
              {pending.length > 0 ? `${pending.length} fatura(s) pendente(s)` : "Nenhuma pendência"}
            </Text>
          </Card>
        </Pressable>

        {reservations.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={T.display(theme.font.lg)}>Suas reservas</Text>
            {reservations.map((r) => (
              <Card key={r.id}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={T.display(theme.font.base)}>{r.assets?.name ?? "Veículo"}</Text>
                  <Chip status={r.status} label={RESERVATION_STATUS_LABEL[r.status]} />
                </View>
                <Text style={[T.text(theme.font.sm), { marginTop: theme.spacing.xs }]}>
                  {new Date(r.period_starts_at).toLocaleDateString("pt-BR")} —{" "}
                  {new Date(r.period_ends_at).toLocaleDateString("pt-BR")}
                </Text>
                <Text style={T.text(theme.font.sm)}>
                  Sinal: {formatCurrency(r.deposit_amount, r.total_currency)} · Saldo:{" "}
                  {formatCurrency(r.balance_amount, r.total_currency)}
                </Text>
                {r.status === "reserved" && (
                  <GradientButton
                    label="Pagar saldo"
                    onPress={() => void handlePayBalance(r.id)}
                    loading={submitting}
                    style={{ marginTop: theme.spacing.sm }}
                  />
                )}
              </Card>
            ))}
          </View>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <Text style={T.display(theme.font.lg)}>Veículos disponíveis</Text>
          <Text style={T.text(theme.font.sm)}>Mesmo valor ou superior ao seu plano atual.</Text>

          <Pressable onPress={() => selectOption(currentAssetId ?? "")}>
            <Card
              style={{
                flexDirection: "row",
                gap: theme.spacing.md,
                alignItems: "center",
                borderColor: isSameCar ? theme.colors.brandSecondary : theme.colors.border,
                borderWidth: isSameCar ? 2 : 1,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surfaceTertiary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={T.text(theme.font.sm)}>Atual</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={T.display(theme.font.base)}>
                  {rental.contract_assets[0]?.assets?.name ?? "Veículo atual"}
                </Text>
                <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
                  {formatCurrency(Number(rental.value_amount), rental.value_currency)}/semana
                </Text>
              </View>
            </Card>
          </Pressable>

          {options.length === 0 ? (
            <EmptyState
              icon="car-outline"
              title="Nenhum outro veículo disponível"
              subtitle="No momento não há opções de igual ou maior valor disponíveis."
            />
          ) : (
            options.map((opt) => {
              const selected = opt.id === selectedId;
              return (
                <Pressable key={opt.id} onPress={() => selectOption(opt.id)}>
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
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>

        {isSameCar ? (
          <GradientButton
            label={submitting ? "Abrindo pagamento..." : "Pagar e renovar"}
            onPress={() => void handleRenewSameCar()}
            loading={submitting}
          />
        ) : (
          selectedOption && (
            <View style={{ gap: theme.spacing.md }}>
              <Text style={T.display(theme.font.lg)}>Escolha o período</Text>
              <Card>
                <Calendar
                  minDate={toDateString(new Date())}
                  markingType="period"
                  markedDates={markedDates as never}
                  onDayPress={onDayPress}
                  theme={{
                    calendarBackground: "transparent",
                    dayTextColor: theme.colors.onSurface,
                    monthTextColor: theme.colors.onSurface,
                    textDisabledColor: theme.colors.muted,
                    arrowColor: theme.colors.brandSecondary,
                    todayTextColor: theme.colors.brandSecondary,
                  }}
                />
              </Card>

              {weeks > 0 && (
                <Card>
                  <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
                    {weeks} semana(s) selecionada(s)
                  </Text>
                  <Text style={[T.display(theme.font.xl), { marginTop: theme.spacing.xs }]}>
                    {formatCurrency(previewTotal, currency)}
                  </Text>
                  <Text style={T.text(theme.font.sm)}>
                    Sinal (20%): {formatCurrency(previewDeposit, currency)} agora · Saldo (80%):{" "}
                    {formatCurrency(previewBalance, currency)} até 1 dia antes
                  </Text>
                </Card>
              )}

              <GradientButton
                label={submitting ? "Abrindo pagamento..." : "Reservar com sinal de 20%"}
                onPress={() => void handleReserveDifferentCar()}
                loading={submitting}
              />
            </View>
          )
        )}
      </View>
    </ScrollView>
  );
}
