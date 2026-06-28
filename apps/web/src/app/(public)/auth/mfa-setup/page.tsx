"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, Copy, Check, Loader2, AlertCircle, ChevronRight, RefreshCw } from "lucide-react";

type Step = "intro" | "qr" | "verify" | "recovery_codes" | "done";

interface QrData {
  factorId: string;
  qrCode: string;
  secret: string;
}

export default function MfaSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleEnrollStart() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Shinã Authenticator",
    });

    if (enrollError || !data) {
      setError(enrollError?.message ?? "Erro ao iniciar enrollment MFA");
      setLoading(false);
      return;
    }

    setQrData({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setStep("qr");
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!qrData || code.length !== 6) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: qrData.factorId,
    });

    if (challengeError || !challengeData) {
      setError(challengeError?.message ?? "Erro ao iniciar desafio");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: qrData.factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      setError("Código inválido. Verifique o QR code escaneado.");
      setLoading(false);
      return;
    }

    // Register enrollment in our DB
    await fetch("/api/auth/mfa/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId: qrData.factorId, method: "totp" }),
    });

    // Generate recovery codes
    const codesRes = await fetch("/api/auth/mfa/recovery-codes", { method: "POST" });
    const codesJson = (await codesRes.json()) as { codes?: string[] };
    setRecoveryCodes(codesJson.codes ?? []);
    setStep("recovery_codes");
    setLoading(false);
  }

  async function handleCopyCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configurar autenticação em duas etapas</h1>
          <p className="text-slate-400 text-sm mt-1">
            Adicione uma camada extra de segurança à sua conta.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["intro", "qr", "verify", "recovery_codes"] as const).map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all ${
                s === step
                  ? "bg-blue-500 w-6"
                  : ["qr", "verify", "recovery_codes", "done"].indexOf(step) > i
                    ? "bg-green-500"
                    : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Step: Intro */}
        {step === "intro" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">Como funciona</h2>
            {[
              "Escaneie o QR code com um aplicativo autenticador (Google Authenticator, Authy, etc.)",
              "Insira o código de 6 dígitos para confirmar a configuração",
              "Salve os códigos de recuperação em local seguro",
            ].map((text, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-300">{text}</p>
              </div>
            ))}

            <button
              id="mfa-setup-start"
              type="button"
              onClick={() => void handleEnrollStart()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Começar <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step: QR Code */}
        {step === "qr" && qrData && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-semibold text-white">Escaneie o QR code</h2>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrData.qrCode}
                alt="QR Code MFA"
                className="w-48 h-48 rounded-xl bg-white p-2"
              />
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">
                Chave manual (se não conseguir escanear)
              </p>
              <p className="text-xs font-mono text-slate-300 break-all">{qrData.secret}</p>
            </div>
            <button
              id="mfa-setup-qr-next"
              type="button"
              onClick={() => setStep("verify")}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition"
            >
              Já escaneei <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step: Verify */}
        {step === "verify" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-5">Confirme o código</h2>
            <form onSubmit={(e) => void handleVerify(e)} className="space-y-4">
              <input
                id="mfa-setup-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xl font-mono tracking-widest text-center placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
              />
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("qr")}
                  className="flex items-center gap-1 px-4 py-3 border border-white/10 text-slate-400 text-sm rounded-xl hover:bg-white/5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Voltar
                </button>
                <button
                  id="mfa-setup-verify-submit"
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Recovery Codes */}
        {step === "recovery_codes" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Códigos de recuperação</h2>
              <p className="text-xs text-slate-400">
                Salve estes códigos em local seguro. Cada código pode ser usado uma única vez se
                perder o acesso ao autenticador.
              </p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 grid grid-cols-2 gap-2">
              {recoveryCodes.map((c) => (
                <span key={c} className="font-mono text-sm text-slate-300 tabular-nums">
                  {c}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                id="mfa-copy-codes"
                type="button"
                onClick={() => void handleCopyCodes()}
                className="flex items-center gap-2 px-4 py-2.5 border border-white/10 text-sm text-slate-300 rounded-xl hover:bg-white/5 transition"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copiado!" : "Copiar"}
              </button>
              <button
                id="mfa-setup-finish"
                type="button"
                onClick={() => router.push("/dashboard")}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold text-sm rounded-xl transition"
              >
                <Check className="w-4 h-4" /> Concluir configuração
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
