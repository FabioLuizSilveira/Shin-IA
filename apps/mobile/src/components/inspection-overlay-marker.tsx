import { useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  PanResponder,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { theme } from "../theme";
import { GradientButton, T } from "./ui";

export interface OverlayRegion {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}

const SEVERITIES: { value: "low" | "medium" | "high" | "critical"; label: string }[] = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

// InspectionOverlayMarker — item 12 of the spec: "Foto → Adicionar avaria
// → tocar/arrastar sobre região → descrição → severidade → salvar",
// targeting 2-3 interactions. Uses React Native's built-in PanResponder
// (no new gesture-handler dependency) for the drag-rectangle, same
// normalized 0..1 coordinate contract as the web InspectionOverlayPicker
// (inspection_findings.overlay_region) — a marking made on mobile reads
// correctly in the Tenant Web drawer and vice versa.
export function InspectionOverlayMarker({
  visible,
  photoUrl,
  saving,
  onCancel,
  onSave,
}: {
  visible: boolean;
  photoUrl: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: {
    region: OverlayRegion;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
  }) => void;
}) {
  const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });
  const [region, setRegion] = useState<OverlayRegion | null>(null);
  const [step, setStep] = useState<"mark" | "describe">("mark");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (!boxSize.width || !boxSize.height) return;
        const { locationX, locationY } = evt.nativeEvent;
        dragStart.current = {
          x: Math.min(1, Math.max(0, locationX / boxSize.width)),
          y: Math.min(1, Math.max(0, locationY / boxSize.height)),
        };
        setRegion(null);
      },
      onPanResponderMove: (evt) => {
        if (!dragStart.current || !boxSize.width || !boxSize.height) return;
        const { locationX, locationY } = evt.nativeEvent;
        const curX = Math.min(1, Math.max(0, locationX / boxSize.width));
        const curY = Math.min(1, Math.max(0, locationY / boxSize.height));
        setRegion({
          type: "rectangle",
          x: Math.min(dragStart.current.x, curX),
          y: Math.min(dragStart.current.y, curY),
          width: Math.abs(curX - dragStart.current.x),
          height: Math.abs(curY - dragStart.current.y),
        });
      },
      onPanResponderRelease: () => {
        dragStart.current = null;
        setRegion((r) => (r && r.width > 0.02 && r.height > 0.02 ? r : null));
      },
    }),
  ).current;

  function reset() {
    setRegion(null);
    setStep("mark");
    setDescription("");
    setSeverity("medium");
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  function handleSave() {
    if (!region || !description.trim()) return;
    onSave({ region, description: description.trim(), severity });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleCancel}
      transparent={false}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 52,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.md,
          }}
        >
          <Pressable onPress={handleCancel}>
            <Text style={T.text(theme.font.base, "#fff")}>Cancelar</Text>
          </Pressable>
          <Text style={[T.display(theme.font.lg), { color: "#fff" }]}>Marcar avaria</Text>
          <View style={{ width: 64 }} />
        </View>

        {step === "mark" ? (
          <>
            <View
              style={{
                flex: 1,
                marginHorizontal: theme.spacing.lg,
                borderRadius: theme.radius.lg,
                overflow: "hidden",
              }}
              onLayout={(e) =>
                setBoxSize({
                  width: e.nativeEvent.layout.width,
                  height: e.nativeEvent.layout.height,
                })
              }
              {...panResponder.panHandlers}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={{ flex: 1 }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              {region && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: `${region.x * 100}%`,
                    top: `${region.y * 100}%`,
                    width: `${region.width * 100}%`,
                    height: `${region.height * 100}%`,
                    borderWidth: 2,
                    borderColor: theme.colors.error,
                    backgroundColor: theme.colors.error + "33",
                  }}
                />
              )}
            </View>
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
              <Text style={T.text(theme.font.sm, "#ccc")}>
                Arraste o dedo sobre a foto para marcar a avaria.
              </Text>
              <GradientButton
                label="Próximo"
                onPress={() => setStep("describe")}
                disabled={!region}
              />
            </View>
          </>
        ) : (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva a avaria (ex: risco no para-choque)"
              placeholderTextColor="#888"
              multiline
              autoFocus
              style={{
                color: "#fff",
                fontSize: theme.font.base,
                minHeight: 80,
                borderWidth: 1,
                borderColor: "#333",
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                textAlignVertical: "top",
              }}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
              {SEVERITIES.map((s) => (
                <Pressable key={s.value} onPress={() => setSeverity(s.value)}>
                  <View
                    style={{
                      paddingVertical: theme.spacing.sm,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: severity === s.value ? theme.colors.brandSecondary : "#333",
                      backgroundColor:
                        severity === s.value ? theme.colors.brandSecondary + "22" : "transparent",
                    }}
                  >
                    <Text
                      style={T.text(
                        theme.font.sm,
                        severity === s.value ? theme.colors.brandSecondary : "#ccc",
                      )}
                    >
                      {s.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <GradientButton
              label={saving ? "Salvando..." : "Salvar"}
              onPress={handleSave}
              loading={saving}
              disabled={!description.trim()}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}
