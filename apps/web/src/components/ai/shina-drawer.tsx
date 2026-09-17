"use client";

// Same hand-rolled drawer chrome as contract-send-signature-modal.tsx
// (this app's real convention for a side panel — @shina/design-system's
// own Drawer component has zero consumers anywhere in apps/web today,
// confirmed by grep before building this; not worth being the first
// integration point for it). useToast() IS real and globally mounted
// (apps/web/src/app/layout.tsx wraps the app in ToastProvider), so error
// feedback goes through it as normal.

import { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Sparkles,
  Paperclip,
  Mic,
  Square,
  Loader2,
  FileText,
  Image,
  Check,
  Circle,
} from "lucide-react";
import { useToast, RadioCard } from "@shina/design-system";

interface ActionPlanField {
  label: string;
  value: string;
}

interface ActionPlan {
  id: string;
  toolName: string;
  riskLevel: string;
  summary: string;
  fields?: ActionPlanField[];
  isDuplicate?: boolean;
}

// Agent Runtime v3, Wave 5 ("UX + Channels", spec sections 38-39) — the
// SAME structured fields every channel's `/api/ai/agent` response now
// carries; only this drawer renders them as UI so far (a text-only
// channel keeps working off `text` alone, which already spells out the
// same info in prose).
interface GoalProgressField {
  key: string;
  label: string;
  required: boolean;
  known: boolean;
}
interface GoalProgress {
  type: string;
  fields: GoalProgressField[];
}
interface OfferedOption {
  id: string;
  name: string;
}
interface OfferedOptionsPayload {
  field: string;
  options: OfferedOption[];
}

interface ShinaMessage {
  role: "user" | "assistant";
  text: string;
  actionPlans?: ActionPlan[];
  goalProgress?: GoalProgress;
  offeredOptions?: OfferedOptionsPayload;
}

interface AgentApiResponse {
  data?: {
    text: string;
    toolsUsed: string[];
    creditsConsumed: number;
    pendingActionPlans?: ActionPlan[];
    goalProgress?: GoalProgress;
    offeredOptions?: OfferedOptionsPayload;
  };
  error?: string;
  code?: string;
}

interface PendingAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
  isImage: boolean;
}

const MAX_ATTACHMENTS = 3;
const ACCEPTED_ATTACHMENT_TYPES =
  "image/png,image/jpeg,image/webp,application/pdf,.docx,text/plain";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("failed to read file"));
    reader.readAsDataURL(file);
  });
}

// Whisper infers the audio container from the upload's filename extension
// (see api/ai/agent/transcribe/route.ts) — map the browser's actual
// MediaRecorder mimeType to a matching extension instead of guessing.
function extensionForMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim();
  if (base === "audio/webm") return "webm";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mp4") return "mp4";
  return "webm";
}

interface ShinaDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Best-effort context for the agent — omitted (null) when this app
   * doesn't yet resolve a "current module" label at the call site; both
   * fields are optional on the backend. */
  currentModule?: string | null;
  currentResource?: { type: string; id: string } | null;
}

export function ShinaDrawer({ open, onClose, currentModule, currentResource }: ShinaDrawerProps) {
  const { show } = useToast();
  const [messages, setMessages] = useState<ShinaMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [resolvingPlanId, setResolvingPlanId] = useState<string | null>(null);
  const [resolvedPlanIds, setResolvedPlanIds] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Agent Runtime v3, Wave 1 — one stable id per drawer session (lazy
  // useState initializer, computed once on mount), sent with every
  // request so the server can remember entities across messages ("esse
  // cliente que acabamos de cadastrar"). Never persisted beyond this
  // component's lifetime — closing and reopening the drawer starts a
  // fresh conversation, matching the master prompt's own "goal
  // continuity" scope (session-level, not indefinite).
  const [conversationId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  async function onFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      show({ message: `Máximo de ${MAX_ATTACHMENTS} anexos por mensagem.`, variant: "warning" });
      return;
    }
    try {
      const encoded = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          mimeType: file.type,
          dataBase64: await fileToBase64(file),
          isImage: file.type.startsWith("image/"),
        })),
      );
      setAttachments((prev) => [...prev, ...encoded]);
    } catch {
      show({ message: "Não foi possível ler um dos arquivos selecionados.", variant: "danger" });
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  // Pasting a screenshot (Ctrl/Cmd+V) drops an image straight into the
  // clipboard as a file, no filename attached — same encode path as a
  // real file pick, just named generically and always treated as an image.
  async function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItems = Array.from(e.clipboardData?.items ?? []).filter(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    if (imageItems.length === 0) return;
    e.preventDefault();

    if (attachments.length + imageItems.length > MAX_ATTACHMENTS) {
      show({ message: `Máximo de ${MAX_ATTACHMENTS} anexos por mensagem.`, variant: "warning" });
      return;
    }
    try {
      const encoded = await Promise.all(
        imageItems.map(async (item, i) => {
          const file = item.getAsFile();
          if (!file) throw new Error("failed to read pasted image");
          const ext = item.type.split("/")[1] ?? "png";
          return {
            name: `imagem-colada-${attachments.length + i + 1}.${ext}`,
            mimeType: item.type,
            dataBase64: await fileToBase64(file),
            isImage: true,
          };
        }),
      );
      setAttachments((prev) => [...prev, ...encoded]);
    } catch {
      show({ message: "Não foi possível colar a imagem.", variant: "danger" });
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const mimeType = recorder.mimeType || "audio/webm";
        void transcribe(new Blob(audioChunksRef.current, { type: mimeType }), mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      show({
        message: "Não foi possível acessar o microfone. Verifique as permissões do navegador.",
        variant: "danger",
      });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function transcribe(blob: Blob, mimeType: string) {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, `recording.${extensionForMimeType(mimeType)}`);
      const res = await fetch("/api/ai/agent/transcribe", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { transcript: string };
        error?: string;
      };
      if (!res.ok || json.error) {
        show({
          message:
            res.status === 403
              ? "Voz ainda não está habilitada para este workspace."
              : (json.error ?? "Não foi possível transcrever o áudio."),
          variant: res.status === 403 ? "info" : "danger",
        });
        return;
      }
      const transcript = json.data?.transcript.trim() ?? "";
      if (!transcript) {
        show({ message: "Não entendi o áudio, tenta de novo.", variant: "warning" });
        return;
      }
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    } catch {
      show({ message: "Não foi possível transcrever o áudio.", variant: "danger" });
    } finally {
      setTranscribing(false);
    }
  }

  // Agent Runtime v3, Wave 5 — shared by both the normal typed-message
  // submit and a chip tap (spec section 39: "Botão deve enviar entityId
  // estruturado quando possível. Não depender do LLM reinterpretar o
  // texto do botão."). `selectedOptionId` bypasses the backend's fuzzy
  // name-matching entirely for that turn's offered-option field.
  async function sendTurn(queryText: string, selectedOptionId?: string) {
    if (sending) return;
    const pendingAttachments = selectedOptionId ? [] : attachments;
    if (!selectedOptionId) {
      setInput("");
      setAttachments([]);
    }
    setMessages((m) => [
      ...m,
      {
        role: "user",
        text: pendingAttachments.length
          ? `${queryText}${queryText ? "\n" : ""}📎 ${pendingAttachments.map((a) => a.name).join(", ")}`
          : queryText,
      },
    ]);
    setSending(true);

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText || "Veja o(s) anexo(s) enviado(s).",
          currentModule,
          currentResource,
          conversationId,
          selectedOptionId,
          attachments: pendingAttachments.length
            ? pendingAttachments.map(({ name, mimeType, dataBase64 }) => ({
                name,
                mimeType,
                dataBase64,
              }))
            : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as AgentApiResponse;

      if (!res.ok || json.error) {
        const message =
          res.status === 403
            ? "Shinã ainda não está habilitada para este workspace."
            : json.code === "insufficient_credits"
              ? "Créditos de IA esgotados. Fale com o administrador do workspace."
              : json.code === "duplicate_request"
                ? "Solicitação duplicada, tente novamente."
                : (json.error ?? "Shinã não conseguiu responder agora. Tente novamente.");
        show({
          message,
          variant: res.status === 403 ? "info" : res.status === 402 ? "warning" : "danger",
        });
        return;
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: json.data?.text ?? "",
          actionPlans: json.data?.pendingActionPlans,
          goalProgress: json.data?.goalProgress,
          offeredOptions: json.data?.offeredOptions,
        },
      ]);
    } catch {
      show({ message: "Shinã não conseguiu responder agora. Tente novamente.", variant: "danger" });
    } finally {
      setSending(false);
    }
  }

  async function send() {
    const query = input.trim();
    if (!query && attachments.length === 0) return;
    await sendTurn(query);
  }

  async function selectOfferedOption(option: OfferedOption) {
    await sendTurn(option.name, option.id);
  }

  async function resolvePlan(planId: string, action: "confirm" | "cancel") {
    setResolvingPlanId(planId);
    try {
      const res = await fetch(`/api/ai/agent/actions/${planId}/${action}`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: unknown;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        // A real production bug (fixed in middleware.ts): a POST here
        // with an expired/missing MFA session used to 405 with no
        // usable message at all. These two codes now come back as a
        // proper JSON error from the middleware — give the user
        // something actionable instead of the raw code string.
        const FRIENDLY_ERROR: Record<string, string> = {
          mfa_challenge_required:
            "Sua verificação de segurança expirou. Atualize a página para confirmar novamente.",
          mfa_setup_required: "Configure a verificação em duas etapas antes de confirmar ações.",
          step_up_required: "Esta ação exige uma verificação de segurança adicional.",
        };
        show({
          message:
            (json.code && FRIENDLY_ERROR[json.code]) ??
            json.error ??
            "Não foi possível concluir a ação.",
          variant: "danger",
        });
        return;
      }
      setResolvedPlanIds((s) => new Set(s).add(planId));
      show({
        message: action === "confirm" ? "Ação confirmada e executada." : "Ação cancelada.",
        variant: "success",
      });
    } catch {
      show({ message: "Não foi possível concluir a ação.", variant: "danger" });
    } finally {
      setResolvingPlanId(null);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Shinã
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border-0 bg-transparent cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-8">
              Pergunte à Shinã sobre contratos, ativos, ou o que essa tela faz.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-shina-blue text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                }`}
              >
                {m.text}
              </div>
              {m.actionPlans?.map((plan) => {
                const resolved = resolvedPlanIds.has(plan.id);
                return (
                  <div
                    key={plan.id}
                    className="max-w-[85%] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3 text-sm"
                  >
                    <p className="text-slate-700 dark:text-slate-200">{plan.summary}</p>
                    {plan.isDuplicate && !resolved && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Já havia um plano igual pendente — reaproveitado.
                      </p>
                    )}
                    {plan.fields && plan.fields.length > 0 && (
                      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
                        {plan.fields.map((field) => (
                          <div key={field.label} className="contents">
                            <dt className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                              {field.label}
                            </dt>
                            <dd className="text-xs text-slate-700 dark:text-slate-200 break-words">
                              {field.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {resolved ? (
                      <p className="mt-2 text-xs text-slate-400">Concluído.</p>
                    ) : (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          disabled={resolvingPlanId === plan.id}
                          onClick={() => void resolvePlan(plan.id, "confirm")}
                          className="px-3 py-1.5 rounded-lg bg-shina-blue text-white text-xs font-medium disabled:opacity-60 cursor-pointer border-0"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          disabled={resolvingPlanId === plan.id}
                          onClick={() => void resolvePlan(plan.id, "cancel")}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium disabled:opacity-60 cursor-pointer border-0"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {m.goalProgress && m.goalProgress.fields.length > 0 && (
                <div className="max-w-[85%] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3 text-sm">
                  <ul className="space-y-1">
                    {m.goalProgress.fields.map((field) => (
                      <li
                        key={field.key}
                        className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                      >
                        {field.known ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <span className={field.known ? "" : "text-slate-400 dark:text-slate-500"}>
                          {field.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Agent Runtime v3, Wave 5 (spec section 39) — only the LATEST
                  assistant turn's offer is tappable; an older message's offer
                  either got consumed or superseded by a later turn, and the
                  backend re-validates membership against the CURRENT goal
                  state regardless (a stale tap on an old render is safely
                  rejected, never silently accepted). */}
              {m.offeredOptions && i === messages.length - 1 && (
                <div className="max-w-[85%] w-full space-y-2">
                  {m.offeredOptions.options.map((option) => (
                    <RadioCard
                      key={option.id}
                      title={option.name}
                      selected={false}
                      disabled={sending}
                      onSelect={() => void selectOfferedOption(option)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 px-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700 p-4 flex flex-col gap-2.5">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div
                  key={`${att.name}-${i}`}
                  className="flex items-center gap-1.5 max-w-[200px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300"
                >
                  {att.isImage ? (
                    <Image className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border-0 bg-transparent cursor-pointer shrink-0"
                    aria-label={`Remover ${att.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_ATTACHMENT_TYPES}
              multiple
              className="hidden"
              onChange={(e) => {
                void onFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || attachments.length >= MAX_ATTACHMENTS}
              title="Anexar documento ou imagem"
              className="p-2.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer border-0 bg-transparent shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => (recording ? stopRecording() : void startRecording())}
              disabled={sending || transcribing}
              title={recording ? "Parar gravação" : "Gravar mensagem de voz"}
              className={`p-2.5 rounded-lg border-0 cursor-pointer shrink-0 disabled:opacity-40 ${
                recording
                  ? "text-white bg-red-500 hover:bg-red-600"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 bg-transparent"
              }`}
            >
              {transcribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : recording ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              onPaste={(e) => void onPaste(e)}
              placeholder={recording ? "Gravando…" : "Pergunte à Shinã… (cole um print aqui)"}
              rows={2}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-shina-blue/30"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || (!input.trim() && attachments.length === 0)}
              className="p-2.5 rounded-lg bg-shina-blue hover:bg-blue-600 text-white disabled:opacity-60 cursor-pointer border-0 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
