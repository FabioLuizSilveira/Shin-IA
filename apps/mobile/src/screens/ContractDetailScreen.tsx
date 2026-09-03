import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { theme } from "../theme";
import { BackHeader, Card, Chip, T, Loader, GradientButton } from "../components/ui";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type ContractDetail, ApiError } from "../lib/shinaia-api";
import type { RootStackParamList } from "../navigation";

const brl = (amount: number, currency: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);

// Local translator, not a shared ui.tsx dictionary entry — same reasoning
// as web's contract-detail.tsx: these status strings are specific to
// electronic-signature requests, not a generic entity status other
// screens' Chip usages should also match against.
const SIGNATURE_STATUS_LABEL: Record<string, string> = {
  draft: "Preparando",
  sent: "Enviada",
  in_progress: "Em andamento",
  signed: "Assinado",
  cancelled: "Cancelada",
  expired: "Expirada",
  failed: "Falhou",
};

// M23 — GET /api/mobile/contracts/{id}. allowedActions is server-computed —
// "accept" only ever appears for a customer identity on a draft contract
// they haven't accepted yet (see apps/web's route); this screen just
// renders whatever the server declares, it never decides eligibility
// itself. POST /api/customer-contracts/{id}/accept re-validates everything
// server-side regardless of what this screen showed.
export function ContractDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "ContractDetail">>();
  const { contractId } = route.params;
  const [accepting, setAccepting] = useState(false);

  const fetcher = useCallback(() => shinaia.contractDetail(contractId), [contractId]);
  const { state, reload } = useAsyncData(fetcher, () => false);

  // dataProcessingConsent is only ever honored server-side when the
  // tenant's configured legal basis for this contract is actually
  // "consent" (see Wave 3 Phase A) — the current GET /api/mobile/contracts/{id}
  // shape doesn't expose that basis to conditionally render a real
  // checkbox, so this screen never claims consent on the user's behalf;
  // the backend simply treats it as not given, which is always the safe
  // default. A future pass can add the field to the endpoint and a real
  // checkbox here.
  async function handleAccept() {
    setAccepting(true);
    try {
      await shinaia.acceptContract(contractId);
      Alert.alert("Sucesso", "Contrato aceito.");
      void reload();
    } catch (err) {
      Alert.alert("Erro", err instanceof ApiError ? err.message : "Falha ao aceitar contrato");
    } finally {
      setAccepting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loader />
      </View>
    );
  }
  if (state.status !== "ready") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, padding: theme.spacing.xl }}>
        <Text style={T.text()}>
          {state.status === "error" ? state.message : "Contrato não encontrado."}
        </Text>
      </View>
    );
  }

  const contract = state.data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <BackHeader title="Contrato" />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Card>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={T.display(theme.font.xxl)}>
              {brl(contract.value_amount, contract.value_currency)}
            </Text>
            <Chip status={contract.status} />
          </View>
          <Text style={T.text(theme.font.sm)}>
            {new Date(contract.period_starts_at).toLocaleDateString("pt-BR")} —{" "}
            {new Date(contract.period_ends_at).toLocaleDateString("pt-BR")}
          </Text>
        </Card>

        {contract.snapshot && (
          <Card>
            <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
              TEXTO DO CONTRATO
            </Text>
            <Text style={[T.text(), { marginTop: theme.spacing.sm }]}>
              {contract.snapshot.rendered_content}
            </Text>
          </Card>
        )}

        <Card>
          <Text style={T.text(theme.font.sm)}>
            Aceite: {contract.acceptance.accepted ? "Confirmado" : "Pendente"}
          </Text>
          <Text style={T.text(theme.font.sm)}>
            Cobrança:{" "}
            {contract.billing.type === "none"
              ? "Não aplicável"
              : contract.billing.satisfied
                ? "Em dia"
                : "Pendente"}
          </Text>
          <Text style={T.text(theme.font.sm)}>
            Documentos: {contract.documents.allApproved ? "Aprovados" : "Pendentes"}
          </Text>
          {contract.signature && (
            <View
              style={{ flexDirection: "row", alignItems: "center", marginTop: theme.spacing.sm }}
            >
              <Text style={T.text(theme.font.sm)}>Assinatura eletrônica: </Text>
              <Chip
                status={contract.signature.status}
                label={
                  SIGNATURE_STATUS_LABEL[contract.signature.status] ?? contract.signature.status
                }
              />
            </View>
          )}
        </Card>

        {contract.allowedActions.includes("accept") && (
          <Card>
            <Text style={[T.text(), { marginBottom: theme.spacing.sm }]}>
              Li e aceito as condições apresentadas acima.
            </Text>
            <GradientButton
              label={accepting ? "Enviando..." : "Aceitar contrato"}
              onPress={() => void handleAccept()}
              loading={accepting}
            />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
