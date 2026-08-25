import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRoute, useFocusEffect, type RouteProp } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { theme } from "../theme";
import { BackHeader, Card, GradientButton, T, Loader } from "../components/ui";
import { useAsyncData } from "../lib/use-async-data";
import { shinaia, type InspectionDetail, type InspectionTemplateItem } from "../lib/shinaia-api";
import { usePersona } from "../lib/persona-context";
import {
  queueResponse,
  queueMedia,
  getQueueStatus,
  flushQueue,
  subscribeToReconnect,
  type QueueStatus,
} from "../lib/inspection-offline-queue";
import type { RootStackParamList } from "../navigation";

// Fase D (docs/architecture/INSPECTION_ENGINE.md) — the guided capture flow
// from item 18 of the spec ("Iniciar vistoria / 3 de 12 / Lateral esquerda
// / Tire uma foto deste ângulo / ABRIR CÂMERA / ✓ Foto registrada /
// PRÓXIMO"): one item at a time, big buttons, clear progress, resumable
// (re-opening the screen re-fetches the real saved state from the server —
// nothing is held only in memory, so a killed app never loses captured
// progress, per item 19 of the spec).

const PHOTO_TYPES = new Set(["photo", "multi_photo"]);

function isPhotoType(fieldType: string): boolean {
  return PHOTO_TYPES.has(fieldType);
}

export function InspectionCaptureScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "InspectionCapture">>();
  const { inspectionId } = route.params;
  const { bootstrap } = usePersona();
  const scope = bootstrap?.user.userType === "operator" ? "operator" : "staff";

  const fetcher = useCallback(
    () => shinaia.inspectionDetail(inspectionId, scope),
    [inspectionId, scope],
  );
  const { state, reload } = useAsyncData(fetcher, () => false);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);

  const refreshQueueStatus = useCallback(() => {
    void getQueueStatus(inspectionId).then(setQueueStatus);
  }, [inspectionId]);

  // Flush on mount, on screen focus (operator switching back to this
  // capture after checking something else), and immediately when the
  // device reconnects — a dropped connection must resolve itself without
  // the operator having to notice and retry manually (item 20 of the
  // spec).
  useEffect(() => {
    void flushQueue(inspectionId, scope).then((s) => {
      setQueueStatus(s);
      if (s.syncedCount > 0 || s.pendingResponses > 0 || s.pendingMedia > 0) void reload(true);
    });
    const unsubscribe = subscribeToReconnect(() => {
      void flushQueue(inspectionId, scope).then((s) => {
        setQueueStatus(s);
        void reload(true);
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, scope]);

  useFocusEffect(
    useCallback(() => {
      void flushQueue(inspectionId, scope).then((s) => {
        setQueueStatus(s);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inspectionId, scope]),
  );

  const items = useMemo(() => {
    if (state.status !== "ready") return [];
    return (state.data.template?.sections ?? []).flatMap((s) => s.items);
  }, [state]);

  // Real state, never local-only: begin the inspection (draft ->
  // in_progress) the first time the checklist actually opens, one write,
  // guarded so a re-render never fires it twice.
  const inspectionStatus = state.status === "ready" ? state.data.inspection.status : null;
  if (inspectionStatus === "draft" && !started) {
    setStarted(true);
    void shinaia.transitionInspection(inspectionId, "in_progress", scope).then(() => reload(true));
  }

  if (state.status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Loader />
      </View>
    );
  }
  if (state.status !== "ready" || !state.data.template) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface, padding: theme.spacing.xl }}>
        <BackHeader title="Vistoria" />
        <Text style={T.text()}>
          {state.status === "error" ? state.message : "Vistoria não encontrada."}
        </Text>
      </View>
    );
  }

  const detail: InspectionDetail = state.data;
  const item = items[index];

  async function handleSubmitForReview() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // The server's completion check only sees what actually reached
      // it — a queued-but-not-yet-synced answer/photo would make
      // submission fail with a confusing "missing item" instead of the
      // real cause. Force a flush first so the only way this legitimately
      // fails offline is if the device truly has nothing to send with.
      const flushed = await flushQueue(inspectionId, scope);
      setQueueStatus(flushed);
      if (flushed.pendingResponses > 0 || flushed.pendingMedia > 0) {
        setSubmitError(
          "Sem conexão — vistoria salva neste aparelho. Envie novamente quando o sinal voltar.",
        );
        setSubmitting(false);
        return;
      }
      await shinaia.transitionInspection(inspectionId, "pending_review", scope);
      Alert.alert("Vistoria enviada", "Enviada para revisão com sucesso.");
      await reload(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar para revisão.";
      setSubmitError(message);
      // Jump back to the first item still missing a response, matching
      // what checkTemplateCompletion() (the same validator the API route
      // runs) would report — the operator sees exactly what's left, not
      // just a generic error.
      const responseByItemId = new Map(detail.responses.map((r) => [r.item_id, r]));
      const mediaCountByItemId = new Map<string, number>();
      for (const m of detail.media) {
        if (m.item_id)
          mediaCountByItemId.set(m.item_id, (mediaCountByItemId.get(m.item_id) ?? 0) + 1);
      }
      const firstMissingIndex = items.findIndex((it) => {
        if (isPhotoType(it.field_type)) {
          const min = it.min_photos ?? (it.required ? 1 : 0);
          return (mediaCountByItemId.get(it.id) ?? 0) < min;
        }
        return it.required && !responseByItemId.get(it.id);
      });
      if (firstMissingIndex >= 0) setIndex(firstMissingIndex);
    } finally {
      setSubmitting(false);
    }
  }

  if (!item) {
    // Every item answered — final screen. Once the operator has actually
    // submitted (status left draft/in_progress), the action shifts from
    // "send for review" to "sign off" (item 15 of the spec: operator
    // signs right after finishing, before anyone else is presented with
    // the checklist) — never both buttons at once, since re-submitting an
    // already-submitted checklist isn't a valid transition anyway.
    const alreadySubmitted =
      detail.inspection.status !== "draft" && detail.inspection.status !== "in_progress";

    async function handleSign() {
      setSigning(true);
      try {
        await shinaia.signInspection(inspectionId, scope);
        setSigned(true);
        Alert.alert("Vistoria assinada", "Sua assinatura foi registrada.");
      } catch {
        Alert.alert("Erro", "Não foi possível registrar a assinatura. Tente novamente.");
      } finally {
        setSigning(false);
      }
    }

    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <BackHeader title="Vistoria" />
        <View
          style={{
            flex: 1,
            padding: theme.spacing.xl,
            justifyContent: "center",
            gap: theme.spacing.lg,
          }}
        >
          <Text style={T.display(theme.font.xxl)}>
            {alreadySubmitted ? "Checklist enviado" : "Checklist completo"}
          </Text>
          <Text style={T.text()}>
            {alreadySubmitted
              ? scope === "operator"
                ? "Confirme sua assinatura para concluir sua parte da vistoria."
                : "Vistoria aguardando revisão."
              : "Todos os itens foram respondidos. Revise e envie para aprovação."}
          </Text>
          {submitError && (
            <Text style={T.text(theme.font.sm, theme.colors.error)}>{submitError}</Text>
          )}
          {!alreadySubmitted && (
            <GradientButton
              label="Enviar para revisão"
              onPress={() => void handleSubmitForReview()}
              loading={submitting}
            />
          )}
          {alreadySubmitted && scope === "operator" && !signed && (
            <GradientButton
              label={signing ? "Assinando..." : "Assinar"}
              onPress={() => void handleSign()}
              loading={signing}
            />
          )}
          {signed && <Text style={T.text(theme.font.sm, theme.colors.success)}>✓ Assinado</Text>}
          {!alreadySubmitted && (
            <Pressable onPress={() => setIndex(items.length - 1)}>
              <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
                Voltar ao último item
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <BackHeader title="Vistoria" />
      <OfflineQueueBanner status={queueStatus} />
      <ChecklistItemStep
        key={item.id}
        item={item}
        response={detail.responses.find((r) => r.item_id === item.id)}
        mediaCount={detail.media.filter((m) => m.item_id === item.id).length}
        index={index}
        total={items.length}
        inspectionId={inspectionId}
        scope={scope}
        onSaved={() => {
          refreshQueueStatus();
          void reload(true);
        }}
        onNext={() => setIndex((i) => Math.min(i + 1, items.length))}
        onPrev={() => setIndex((i) => Math.max(i - 1, 0))}
      />
    </View>
  );
}

// Item 20 of the spec's own worked example: "✓ 8 itens sincronizados /
// ⟳ 2 fotos aguardando envio / Sem conexão — vistoria salva neste
// aparelho". Silent when there's nothing to report, so it doesn't add
// noise to a screen that's fully synced.
function OfflineQueueBanner({ status }: { status: QueueStatus | null }) {
  if (!status) return null;
  const pending = status.pendingResponses + status.pendingMedia;
  if (pending === 0 && status.online) return null;
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        backgroundColor: status.online ? theme.colors.warning + "1A" : theme.colors.error + "1A",
      }}
    >
      {!status.online && (
        <Text style={T.text(theme.font.sm, theme.colors.error)}>
          Sem conexão — vistoria salva neste aparelho
        </Text>
      )}
      {pending > 0 && (
        <Text style={T.text(theme.font.sm, theme.colors.warning)}>
          ⟳ {pending} item{pending === 1 ? "" : "s"} aguardando envio
        </Text>
      )}
      {status.syncedCount > 0 && pending === 0 && status.online && (
        <Text style={T.text(theme.font.sm, theme.colors.success)}>
          ✓ {status.syncedCount} sincronizado{status.syncedCount === 1 ? "" : "s"}
        </Text>
      )}
    </View>
  );
}

function ChecklistItemStep({
  item,
  response,
  mediaCount,
  index,
  total,
  inspectionId,
  scope,
  onSaved,
  onNext,
  onPrev,
}: {
  item: InspectionTemplateItem;
  response?: {
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_json: { value: string; label: string; severity?: string } | null;
  };
  mediaCount: number;
  index: number;
  total: number;
  inspectionId: string;
  scope: "staff" | "operator";
  onSaved: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [textValue, setTextValue] = useState(response?.value_text ?? "");
  const [cameraOpen, setCameraOpen] = useState(false);

  const minPhotos = item.min_photos ?? (item.required ? 1 : 0);
  const photoSatisfied = !isPhotoType(item.field_type) || mediaCount >= minPhotos;

  async function saveValue(value: {
    valueText?: string | null;
    valueNumber?: number | null;
    valueBoolean?: boolean | null;
    valueJson?: unknown;
  }) {
    setSaving(true);
    try {
      // Local-first: queueResponse() never throws — it persists to
      // AsyncStorage before attempting the network, so a dropped
      // connection here degrades to "queued for later", never a lost
      // answer or a hard error blocking the operator's progress.
      await queueResponse(inspectionId, item.id, value, scope);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
    >
      <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>
        {index + 1} / {total}
      </Text>
      <Text style={T.display(theme.font.xxl)}>{item.label}</Text>
      {item.instructions && <Text style={T.text()}>{item.instructions}</Text>}

      {isPhotoType(item.field_type) ? (
        <Card style={{ gap: theme.spacing.md, alignItems: "center" }}>
          {cameraOpen ? (
            <InlineCamera
              onCapture={async (uri) => {
                setCameraOpen(false);
                setSaving(true);
                try {
                  let latitude: number | undefined;
                  let longitude: number | undefined;
                  try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === "granted") {
                      const pos = await Location.getCurrentPositionAsync({});
                      latitude = pos.coords.latitude;
                      longitude = pos.coords.longitude;
                    }
                  } catch {
                    // Geolocation is best-effort (item 6 of the spec: "quando
                    // autorizada") — never blocks the capture itself.
                  }
                  // Same local-first guarantee as saveValue() — the file
                  // stays at its local uri regardless of network state,
                  // so queueing it costs nothing extra and never blocks
                  // capture on a bad connection.
                  await queueMedia(
                    inspectionId,
                    uri,
                    { itemId: item.id, latitude, longitude },
                    scope,
                  );
                  onSaved();
                } finally {
                  setSaving(false);
                }
              }}
              onCancel={() => setCameraOpen(false)}
            />
          ) : (
            <>
              <Text style={T.text(theme.font.base, theme.colors.onSurface)}>
                {mediaCount} / {minPhotos || 1} foto{minPhotos === 1 ? "" : "s"}
                {photoSatisfied ? " ✓" : ""}
              </Text>
              <GradientButton
                label={saving ? "Enviando..." : "Abrir Câmera"}
                icon="camera-outline"
                onPress={() => setCameraOpen(true)}
                loading={saving}
              />
            </>
          )}
        </Card>
      ) : item.field_type === "boolean" ? (
        <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
          <ChoiceButton
            label="Sim"
            active={response?.value_boolean === true}
            onPress={() => void saveValue({ valueBoolean: true })}
          />
          <ChoiceButton
            label="Não"
            active={response?.value_boolean === false}
            onPress={() => void saveValue({ valueBoolean: false })}
          />
        </View>
      ) : item.field_type === "single_select" || item.field_type === "condition" ? (
        <View style={{ gap: theme.spacing.sm }}>
          {(item.select_options ?? []).map((opt) => (
            <ChoiceButton
              key={opt.value}
              label={opt.label}
              active={response?.value_json?.value === opt.value}
              tone={opt.severity ? "warning" : undefined}
              onPress={() => void saveValue({ valueJson: opt })}
            />
          ))}
        </View>
      ) : (
        <Card>
          <SimpleTextInput
            value={textValue}
            keyboardType={
              ["number", "odometer", "hour_meter", "percentage"].includes(item.field_type)
                ? "numeric"
                : "default"
            }
            onChangeText={setTextValue}
            onBlur={() => {
              const isNumeric = ["number", "odometer", "hour_meter", "percentage"].includes(
                item.field_type,
              );
              void saveValue(
                isNumeric ? { valueNumber: Number(textValue) || 0 } : { valueText: textValue },
              );
            }}
          />
        </Card>
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: theme.spacing.lg,
        }}
      >
        <Pressable onPress={onPrev} disabled={index === 0}>
          <Text
            style={T.text(
              theme.font.base,
              index === 0 ? theme.colors.muted : theme.colors.brandSecondary,
            )}
          >
            Anterior
          </Text>
        </Pressable>
        <GradientButton
          label={saving ? "Salvando..." : "Próximo"}
          onPress={onNext}
          loading={saving}
          style={{ minWidth: 140 }}
        />
      </View>
    </ScrollView>
  );
}

function ChoiceButton({
  label,
  active,
  tone,
  onPress,
}: {
  label: string;
  active: boolean;
  tone?: "warning";
  onPress: () => void;
}) {
  const color = tone === "warning" ? theme.colors.warning : theme.colors.brandSecondary;
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          borderRadius: theme.radius.md,
          borderWidth: 2,
          borderColor: active ? color : theme.colors.border,
          backgroundColor: active ? color + "22" : theme.colors.surfaceSecondary,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          alignItems: "center",
        }}
      >
        <Text style={T.text(theme.font.base, active ? color : theme.colors.onSurface)}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function SimpleTextInput(props: {
  value: string;
  keyboardType: "default" | "numeric";
  onChangeText: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <TextInput
      value={props.value}
      keyboardType={props.keyboardType}
      onChangeText={props.onChangeText}
      onBlur={props.onBlur}
      placeholder="Digite aqui"
      placeholderTextColor={theme.colors.muted}
      style={{
        color: theme.colors.onSurface,
        fontSize: theme.font.lg,
        paddingVertical: theme.spacing.sm,
      }}
    />
  );
}

// Full-screen-ish inline camera — permission handled here so the parent
// step doesn't need to know about expo-camera at all. Expo Go supports
// expo-camera (confirmed against the SDK 56 docs before adding this
// dependency — unlike Google Sign-In, which is structurally broken there).
function InlineCamera({
  onCapture,
  onCancel,
}: {
  onCapture: (uri: string) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);

  if (!permission) return <ActivityIndicator color={theme.colors.brandSecondary} />;
  if (!permission.granted) {
    return (
      <View style={{ alignItems: "center", gap: theme.spacing.md }}>
        <Text style={T.text()}>Precisamos da câmera para registrar a vistoria.</Text>
        <GradientButton label="Permitir câmera" onPress={() => void requestPermission()} />
        <Pressable onPress={onCancel}>
          <Text style={T.text(theme.font.sm, theme.colors.brandSecondary)}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 3 / 4,
        borderRadius: theme.radius.lg,
        overflow: "hidden",
      }}
    >
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View
        style={{
          position: "absolute",
          bottom: theme.spacing.lg,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: theme.spacing.lg,
        }}
      >
        <Pressable onPress={onCancel}>
          <Text style={[T.text(theme.font.base, "#fff"), { padding: theme.spacing.md }]}>
            Cancelar
          </Text>
        </Pressable>
        <Pressable
          disabled={capturing}
          onPress={async () => {
            setCapturing(true);
            try {
              const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
              if (photo?.uri) onCapture(photo.uri);
            } finally {
              setCapturing(false);
            }
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "#fff",
              borderWidth: 4,
              borderColor: theme.colors.brandSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {capturing && <ActivityIndicator color={theme.colors.brandSecondary} />}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
