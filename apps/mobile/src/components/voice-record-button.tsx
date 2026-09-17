import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import { theme } from "../theme";
import {
  recordAndAsk,
  selectOfferedOption,
  type OfferedOption,
  type AgentReply,
} from "../lib/voice-agent";

type State = "idle" | "recording" | "processing" | "result" | "error";

// Press-and-hold push-to-talk, mounted once at the root (above whichever
// persona's navigator is active) — not a 6th tab, per the product spec's
// "no wake word, no always-listening mic, strictly press-and-hold" rule.
// No voice OUTPUT — the reply is shown as text only.
export function VoiceRecordButton() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [offeredOptions, setOfferedOptions] = useState<OfferedOption[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");

  function applyReply(r: AgentReply) {
    setReply(r.text);
    setOfferedOptions(r.offeredOptions?.options ?? []);
    setState("result");
  }

  // Agent Runtime v3, Wave 5 (spec section 39) — tapping an offered
  // option submits its real id, never asking the model to re-interpret
  // a re-typed/re-spoken name. Mirrors shina-drawer.tsx's
  // selectOfferedOption on web.
  async function pickOption(option: OfferedOption) {
    setSelecting(true);
    setError("");
    try {
      const r = await selectOfferedOption(option);
      applyReply(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
      setState("error");
    } finally {
      setSelecting(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    })();
  }, []);

  async function startRecording() {
    if (state !== "idle" && state !== "result" && state !== "error") return;
    setTranscript("");
    setReply("");
    setOfferedOptions([]);
    setError("");
    await recorder.prepareToRecordAsync();
    recorder.record();
    setState("recording");
  }

  async function stopRecording() {
    if (!recorderState.isRecording) return;
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setState("idle");
      return;
    }
    setState("processing");
    try {
      const { transcript: t, reply: r } = await recordAndAsk(uri);
      setTranscript(t);
      applyReply(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo deu errado.");
      setState("error");
    }
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {(state === "processing" || state === "result" || state === "error") && (
        <View style={styles.card}>
          {state === "processing" && (
            <View style={styles.row}>
              <ActivityIndicator color={theme.colors.brandSecondary} />
              <Text style={styles.cardText}>Shinã está pensando…</Text>
            </View>
          )}
          {state === "result" && (
            <>
              <Text style={styles.transcript}>"{transcript}"</Text>
              <Text style={styles.reply}>{reply}</Text>
              {offeredOptions.length > 0 && (
                <View style={styles.options}>
                  {offeredOptions.map((option) => (
                    <Pressable
                      key={option.id}
                      disabled={selecting}
                      onPress={() => void pickOption(option)}
                      style={styles.optionChip}
                    >
                      <Text style={styles.optionChipText}>{option.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
          {state === "error" && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={() => setState("idle")} style={styles.dismiss}>
            <Ionicons name="close" size={16} color={theme.colors.muted} />
          </Pressable>
        </View>
      )}

      <Pressable
        onPressIn={() => void startRecording()}
        onPressOut={() => void stopRecording()}
        style={styles.fab}
      >
        <LinearGradient
          colors={recorderState.isRecording ? ["#EF4444", "#DC2626"] : theme.gradients.neural}
          style={styles.fabGradient}
        >
          <Ionicons name={recorderState.isRecording ? "radio" : "mic"} size={26} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: theme.spacing.lg,
    bottom: theme.spacing.xxxl,
    alignItems: "flex-end",
  },
  fab: { borderRadius: theme.radius.pill },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  card: {
    maxWidth: 260,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  transcript: { color: theme.colors.muted, fontSize: theme.font.sm, fontStyle: "italic" },
  reply: {
    color: theme.colors.onSurfaceSecondary,
    fontSize: theme.font.sm,
    marginTop: theme.spacing.xs,
  },
  cardText: { color: theme.colors.onSurfaceSecondary, fontSize: theme.font.sm },
  error: { color: "#F87171", fontSize: theme.font.sm },
  dismiss: { position: "absolute", top: 6, right: 6 },
  options: { marginTop: theme.spacing.sm, gap: theme.spacing.xs },
  optionChip: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  optionChipText: { color: theme.colors.onSurfaceSecondary, fontSize: theme.font.sm },
});
