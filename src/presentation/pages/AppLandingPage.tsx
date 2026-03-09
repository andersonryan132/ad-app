"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TIMESTAMP_KEY = "auth_token_created_at";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_SERVER ?? "http://localhost:8000";
const OCCURRENCES_ENDPOINT = `${API_BASE_URL.replace(/\/$/, "")}/ocorrencias`;

type OccurrenceItem = {
  id?: number;
  cliente?: string;
  contrato?: number;
  status?: string;
  status_id?: number;
  data_agendamento?: string;
  hora_agendamento?: string;
  data_cadastro?: string;
  hora_cadastro?: string;
  motivo?: string;
  conteudo?: string;
};

type OccurrencesResponse = {
  ok: boolean;
  ocorrencias: unknown;
  message?: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getStatusLabel = (item: OccurrenceItem) => {
  if (item.status) {
    return item.status;
  }
  if (typeof item.status_id === "number") {
    return item.status_id === 0 ? "Aberta" : "Encerrada";
  }
  return "Indefinido";
};

const getStatusBadgeClass = (statusId?: number) => {
  if (statusId === 1) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (statusId === 0) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-600";
};

const normalizeDate = (value?: string) => (value && value !== "" ? value : "N/A");
const normalizeTime = (value?: string) => (value && value !== "" ? value : "--:--");

const parseErrorMessage = async (response: Response) => {
  try {
    const text = await response.text();
    if (!text) {
      return `Erro HTTP ${response.status} (${response.statusText})`;
    }
    try {
      const parsed = JSON.parse(text) as { message?: string };
      return parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return `Erro HTTP ${response.status} (${response.statusText})`;
  }
};

const getAuthToken = () => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
};

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function VehicleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M4 16h16l-2-6H6l-2 6z" />
      <path d="M7 16v2a1 1 0 001 1h3.3m4.7 0h3a1 1 0 001-1v-2" />
      <circle cx="7.5" cy="16.5" r="1.5" />
      <circle cx="16.5" cy="16.5" r="1.5" />
    </svg>
  );
}

function StockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M21 10v7l-9 4-9-4v-7" />
      <path d="M12 14v4" />
    </svg>
  );
}

function ApprovalsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M9 17h6" />
      <path d="M12 4v13" />
      <circle cx="12" cy="18" r="1" />
      <path d="M4 7h4" />
      <path d="M16 7h4" />
      <path d="M4 11h4" />
      <path d="M16 11h4" />
      <path d="M4 15h4" />
      <path d="M16 15h4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export default function AppLandingPage() {
  const router = useRouter();

  const [openOccurrences, setOpenOccurrences] = useState<OccurrenceItem[]>([]);
  const [closedOccurrences, setClosedOccurrences] = useState<OccurrenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closeTarget, setCloseTarget] = useState<OccurrenceItem | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [closeDateTime, setCloseDateTime] = useState("");
  const [tokenExpired, setTokenExpired] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [closeError, setCloseError] = useState("");

  const toDateTimeLocalValue = () => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const closeReasonValid = useMemo(
    () => closeReason.trim().length > 0 && closeDateTime.trim().length > 0,
    [closeReason, closeDateTime],
  );

  const redirectToLogin = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
    }
    router.replace("/");
  };

  const fetchOccurrences = async (status: number, token: string) => {
    const response = await fetch(OCCURRENCES_ENDPOINT, {
      method: "POST",
      mode: "cors",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (response.status === 401) {
      setTokenExpired(true);
      throw new Error("Sessao expirada. Faça login novamente.");
    }

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(message);
    }

    const payload = (await response.json()) as OccurrencesResponse;
    if (!payload.ok) {
      throw new Error(payload.message || "Resposta invalida da API");
    }

    if (!Array.isArray(payload.ocorrencias)) {
      throw new Error("Resposta da API sem lista de ocorrencias.");
    }

    return payload.ocorrencias.filter(isObject) as OccurrenceItem[];
  };

  useEffect(() => {
    if (tokenExpired) {
      redirectToLogin();
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");

      const token = getAuthToken();
      if (!token) {
        redirectToLogin();
        setLoading(false);
        return;
      }

      try {
        const [openData, closedData] = await Promise.all([fetchOccurrences(0, token), fetchOccurrences(1, token)]);
        setOpenOccurrences(openData);
        setClosedOccurrences(closedData);
      } catch (err) {
        const message =
          err instanceof TypeError
            ? `Falha ao conectar na API ${OCCURRENCES_ENDPOINT}. Verifique se o backend esta no ar e se o CORS esta habilitado.`
            : err instanceof Error
              ? err.message
              : "Falha inesperada ao carregar ocorrencias.";
        setError(message);
        if (tokenExpired) {
          redirectToLogin();
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router, tokenExpired]);

  useEffect(() => {
    if (tokenExpired) {
      redirectToLogin();
    }
  }, [tokenExpired, router]);

  const handleOpenCloseModal = (occurrence: OccurrenceItem) => {
    setCloseTarget(occurrence);
    setCloseReason("");
    setCloseDateTime(toDateTimeLocalValue());
    setCloseError("");
  };

  const handleCloseModal = () => {
    setCloseTarget(null);
    setCloseReason("");
    setCloseDateTime("");
    setCloseError("");
  };

  const submitCloseReason = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!closeTarget) return;
    if (!closeReasonValid) return;

    if (closeTarget.id == null) {
      setCloseError("Nao foi possivel identificar o chamado.");
      setCloseSubmitting(false);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    setCloseSubmitting(true);
    setCloseError("");

    try {
      const response = await fetch(`${OCCURRENCES_ENDPOINT}/${closeTarget.id}`, {
        method: "POST",
        mode: "cors",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          os_servicoprestado: closeReason,
          os_status: 1,
          os_data_finalizacao: `${closeDateTime.replace("T", " ")}:00`,
        }),
      });

      if (response.status === 401) {
        setTokenExpired(true);
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message);
      }

      const closedId = closeTarget.id;
      if (closedId !== undefined) {
        setOpenOccurrences((current) => current.filter((item) => item.id !== closedId));
      }

      handleCloseModal();
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Falha ao conectar para encerrar ocorrencia."
          : err instanceof Error
            ? err.message
            : "Falha inesperada ao encerrar ocorrencia.";
      setCloseError(message);
      if (tokenExpired) {
        redirectToLogin();
      }
    } finally {
      setCloseSubmitting(false);
    }
  };

  const renderOccurrenceRow = (occurrence: OccurrenceItem, canClose = false) => (
    <li
      key={occurrence.id ?? `${occurrence.cliente ?? "cliente"}-${occurrence.data_cadastro ?? ""}-${occurrence.hora_cadastro ?? ""}`}
      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{occurrence.conteudo || "Sem descricao"}</p>
          <p className="mt-1 text-xs text-slate-600">
            Cliente: {occurrence.cliente || "Nao informado"} | Contrato: {occurrence.contrato ?? "N/A"}
          </p>
          <p className="text-xs text-slate-600">
            Agendamento: {normalizeDate(occurrence.data_agendamento)} {normalizeTime(occurrence.hora_agendamento)}
          </p>
          <p className="text-xs text-slate-600">
            Cadastro: {normalizeDate(occurrence.data_cadastro)} {normalizeTime(occurrence.hora_cadastro)}
          </p>
          {occurrence.motivo ? <p className="text-xs text-slate-600">Motivo: {occurrence.motivo}</p> : null}
          <p className="mt-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                occurrence.status_id,
              )}`}
            >
              Status: {getStatusLabel(occurrence)}
            </span>
          </p>
        </div>

        {canClose ? (
          <button
            type="button"
            onClick={() => handleOpenCloseModal(occurrence)}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            Encerrar
          </button>
        ) : null}
      </div>
    </li>
  );

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Painel do dia</h1>
          <p className="mt-1 text-sm text-slate-600">Acompanhe as ocorrencias agendadas e encerradas.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {error ? (
            <article className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </article>
          ) : null}

          {loading ? (
            <article className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Carregando ocorrencias...
            </article>
          ) : null}

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Ocorrencias agendadas para hoje</h2>
            <div className="mt-3 h-72 overflow-y-auto pr-2">
              <ul className="space-y-2">
                {openOccurrences.length === 0 && !loading && !error ? (
                  <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Nenhuma ocorrencia aberta no momento.
                  </li>
                ) : (
                  openOccurrences.map((item) => renderOccurrenceRow(item, item.status_id === 0))
                )}
              </ul>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Ocorrencia encerrada hoje</h2>
            <div className="mt-3 h-72 overflow-y-auto pr-2">
              <ul className="space-y-2">
                {closedOccurrences.length === 0 && !loading && !error ? (
                  <li className="rounded-xl border border-slate-200 bg-emerald-50 px-3 py-2 text-sm text-slate-500">
                    Nenhuma ocorrencia encerrada no momento.
                  </li>
                ) : (
                  closedOccurrences.map((item) => renderOccurrenceRow(item, false))
                )}
              </ul>
            </div>
          </article>
        </div>
      </section>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-around px-4">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
            aria-label="Inicio"
          >
            <HomeIcon />
          </button>
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
            aria-label="Abastecimentos"
            onClick={() => router.push("/app/fuelings")}
          >
            <VehicleIcon />
          </button>
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
            aria-label="Estoque"
            onClick={() => router.push("/app/inventory")}
          >
            <StockIcon />
          </button>
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
            aria-label="Aprovacoes"
            onClick={() => router.push("/app/approvals")}
          >
            <ApprovalsIcon />
          </button>
        </nav>
      </footer>

      {closeTarget ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Encerrar ocorrencia</h3>
            <p className="mt-2 text-sm text-slate-600">
              Informe o motivo para encerrar a ocorrencia <span className="font-semibold">#{closeTarget.id}</span>.
            </p>
            <form className="mt-3 space-y-3" onSubmit={submitCloseReason}>
              {closeError ? <p className="text-sm text-red-700">{closeError}</p> : null}
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Motivo</span>
                <textarea
                  className="min-h-28 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={closeReason}
                  onChange={(event) => setCloseReason(event.target.value)}
                  placeholder="Descreva o motivo do encerramento..."
                  required
                  disabled={closeSubmitting}
                />
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Data de encerramento</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={closeDateTime}
                  onChange={(event) => setCloseDateTime(event.target.value)}
                  required
                  disabled={closeSubmitting}
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={closeSubmitting}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!closeReasonValid || closeSubmitting}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {closeSubmitting ? "Enviando..." : "Encerrar chamado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

