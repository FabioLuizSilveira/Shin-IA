"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  fetchMyRentals,
  fetchMyRentalCustomerId,
  fetchServiceRequests,
  createServiceRequest,
  type Rental,
  type ServiceRequest,
} from "@/lib/rentals-portal";
import { CustomerHeader } from "@/components/customer/customer-header";
import { Loader2 } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  draft: "Rascunho",
  expired: "Expirado",
  terminated: "Encerrado",
  suspended: "Suspenso",
};

const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  resolved: "Resolvido",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

export default function RentalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rentalId = params.id;

  const [rental, setRental] = useState<Rental | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchMyRentals(), fetchServiceRequests(rentalId)])
      .then(([rentals, reqs]) => {
        setRental(rentals.find((r) => r.id === rentalId) ?? null);
        setRequests(reqs);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [rentalId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReportIssue() {
    if (!rental || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const rentalCustomerId = await fetchMyRentalCustomerId();
      await createServiceRequest({
        tenantContractId: rental.id,
        rentalCustomerId,
        tenantId: rental.tenant_id,
        type: "issue",
        message: message.trim(),
      });
      setMessage("");
      setSentNotice(true);
      setTimeout(() => setSentNotice(false), 3000);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-950 px-4">
        <p className="text-sm text-slate-400">{error ?? "Locação não encontrada."}</p>
        <button
          onClick={() => router.push("/rentals")}
          className="text-sm text-shina-cyan font-semibold cursor-pointer border-0 bg-transparent"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <CustomerHeader
        title={STATUS_LABEL[rental.status] ?? rental.status}
        onBack={() => router.push("/rentals")}
      />

      <div className="px-4 py-4 max-w-xl mx-auto space-y-5">
        {rental.contract_assets[0]?.assets?.metadata?.photo_url && (
          <Image
            src={rental.contract_assets[0].assets.metadata.photo_url}
            alt={rental.contract_assets[0].assets.name}
            width={600}
            height={220}
            className="w-full h-44 rounded-xl object-cover bg-white/10"
            unoptimized
          />
        )}

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs text-slate-400">Período</p>
            <p className="text-sm font-medium text-white">
              {formatDate(rental.period_starts_at)} — {formatDate(rental.period_ends_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Valor</p>
            <p className="text-sm font-medium text-white">
              {formatCurrency(Number(rental.value_amount), rental.value_currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Ativos</p>
            {rental.contract_assets.map((ca) => (
              <p key={ca.id} className="text-sm font-medium text-white">
                {ca.assets?.name ?? "—"} (qtd: {ca.quantity})
              </p>
            ))}
          </div>
        </div>

        {rental.status === "active" && (
          <Link
            href={`/rentals/${rental.id}/renew`}
            className="block text-center px-4 py-2.5 bg-gradient-to-r from-shina-blue to-shina-cyan text-white text-sm font-semibold rounded-xl transition hover:opacity-90"
          >
            Renovar contrato
          </Link>
        )}

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-bold text-white">Solicitar</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Descreva o problema..."
            rows={4}
            className="w-full px-3 py-2 text-sm rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-500"
          />
          <button
            type="button"
            disabled={submitting || !message.trim()}
            onClick={() => void handleReportIssue()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl border-0 cursor-pointer transition disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Reportar problema
          </button>
          {sentNotice && (
            <p className="text-xs text-green-400">Seu pedido foi enviado ao locador.</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {requests.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-white">Histórico de pedidos</p>
            {requests.map((r) => (
              <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    {r.type === "extension" ? "Prorrogação" : "Problema"}
                  </span>
                  <span className="text-xs font-semibold text-shina-cyan">
                    {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1">{r.message}</p>
                <p className="text-xs text-slate-500 mt-1">{formatDate(r.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
