"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TIMESTAMP_KEY = "auth_token_created_at";
const APPROVALS_ENDPOINT = "/inventory/transfer-requests";

type ApprovalStatus = "pending" | "approved" | "rejected" | string;

type ApprovalItem = {
  productId: number;
  productName: string;
  quantity: number;
};

type ApprovalRequest = {
  id: number;
  requestType: string;
  status: ApprovalStatus;
  notes: string;
  fromUserId: number | null;
  fromUserName: string | null;
  toUserId: number | null;
  toUserName: string | null;
  requestedById: number | null;
  requestedByName: string | null;
  approvedById: number | null;
  createdAt: string;
  items: ApprovalItem[];
};

type ApprovalsResponse = {
  ok: boolean;
  total?: number;
  requests?: unknown;
  message?: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumber = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeApprovalItem = (value: unknown): ApprovalItem | null => {
  if (!isObject(value)) return null;

  const productId = Number.parseInt(String(value.productId ?? 0), 10);
  if (!Number.isFinite(productId)) return null;

  return {
    productId,
    productName: String(value.productName ?? ""),
    quantity: toNumber(value.quantity),
  };
};

const normalizeApproval = (value: unknown): ApprovalRequest | null => {
  if (!isObject(value)) return null;

  const id = Number.parseInt(String(value.id ?? 0), 10);
  if (!Number.isFinite(id)) return null;

  const rawItems = Array.isArray(value.items) ? value.items : [];
  const normalizedItems = rawItems.map(normalizeApprovalItem).filter((item): item is ApprovalItem => item !== null);

  return {
    id,
    requestType: String(value.requestType ?? "N/A"),
    status: String(value.status ?? "N/A"),
    notes: String(value.notes ?? ""),
    fromUserId: toNullableNumber(value.fromUserId),
    fromUserName: value.fromUserName == null ? null : String(value.fromUserName),
    toUserId: toNullableNumber(value.toUserId),
    toUserName: value.toUserName == null ? null : String(value.toUserName),
    requestedById: toNullableNumber(value.requestedById),
    requestedByName: value.requestedByName == null ? null : String(value.requestedByName),
    approvedById: toNullableNumber(value.approvedById),
    createdAt: String(value.createdAt ?? ""),
    items: normalizedItems,
  };
};

const getStatusLabel = (status: ApprovalStatus) => {
  if (status === "approved") return "Aprovada";
  if (status === "pending") return "Pendente";
  if (status === "rejected") return "Rejeitada";
  return String(status);
};

const getStatusBadgeClass = (status: ApprovalStatus) => {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
};

const formatDateTime = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR");
};

function ApprovalsPageContent() {
  const router = useRouter();

  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tokenExpired, setTokenExpired] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [total, setTotal] = useState(0);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseError, setResponseError] = useState("");

  const redirectToLogin = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
    }
    router.replace("/");
  };

  const loadApprovals = async () => {
    setLoading(true);
    setError("");

    const token = getAuthToken();
    if (!token) {
      redirectToLogin();
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(APPROVALS_ENDPOINT, {
        method: "GET",
        mode: "cors",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setTokenExpired(true);
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message);
      }

      const payload = (await response.json()) as ApprovalsResponse;
      if (!payload.ok) {
        throw new Error(payload.message || "Resposta invalida da API");
      }

      if (!Array.isArray(payload.requests)) {
        throw new Error("Resposta da API sem lista de solicitacoes.");
      }

      const normalizedRequests = payload.requests
        .map(normalizeApproval)
        .filter((item): item is ApprovalRequest => item !== null);
      setRequests(normalizedRequests);
      setTotal(payload.total ?? normalizedRequests.length);
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Falha ao conectar na API. Verifique se o backend esta no ar e se o CORS esta habilitado."
          : err instanceof Error
            ? err.message
            : "Falha inesperada ao carregar solicitacoes.";
      setError(message);
      if (tokenExpired) {
        redirectToLogin();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenExpired) {
      redirectToLogin();
      return;
    }
    loadApprovals();
  }, [router, tokenExpired]);

  const getRequestUserName = (
    userId: number | null,
    userName: string | null,
    fallbackLabel: string,
  ) => {
    if (userName) return userName;
    if (userId === null) return "N/A";
    return `ID ${userId}`;
  };

  const openResponsePopup = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setResponseError("");
  };

  const closeResponsePopup = () => {
    setSelectedRequest(null);
    setResponseError("");
  };

  const respondToRequest = async (action: "approve" | "reject") => {
    if (!selectedRequest) return;

    const token = getAuthToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    setResponseLoading(true);
    setResponseError("");

    try {
      const response = await fetch(`${APPROVALS_ENDPOINT}/${selectedRequest.id}/${action}`, {
        method: "POST",
        mode: "cors",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        setTokenExpired(true);
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message);
      }

      await loadApprovals();
      closeResponsePopup();
    } catch (err) {
      const message =
        err instanceof TypeError
          ? `Falha ao conectar na API ${APPROVALS_ENDPOINT}. Verifique se o backend esta no ar e se o CORS esta habilitado.`
          : err instanceof Error
            ? err.message
            : "Falha inesperada ao processar solicitacao.";
      setResponseError(message);
      if (tokenExpired) {
        redirectToLogin();
      }
    } finally {
      setResponseLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 pb-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Aprovacoes</h1>
            <p className="mt-1 text-sm text-slate-600">Total de solicitacoes: {total}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/app")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar
          </button>
        </header>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {loading ? <p className="text-sm text-slate-600">Carregando solicitacoes...</p> : null}
          {!loading && !error && requests.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma solicitacao encontrada.</p>
          ) : null}

          <ul className="space-y-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{request.notes || "Sem observacao"}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      De: {getRequestUserName(request.fromUserId, request.fromUserName, "Solicitante")}
                    </p>
                    <p className="text-xs text-slate-600">
                      Para: {getRequestUserName(request.toUserId, request.toUserName, "Recebedor")}
                    </p>
                    <p className="text-xs text-slate-600">
                      Solicitado por: {getRequestUserName(request.requestedById, request.requestedByName, "Solicitante")}
                    </p>
                    <p className="text-xs text-slate-600">Criada em: {formatDateTime(request.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => openResponsePopup(request)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Visualizar itens
                    </button>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusBadgeClass(
                        request.status,
                      )}`}
                    >
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {selectedRequest ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Solicitacao #{selectedRequest.id}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Tipo: {selectedRequest.requestType}
            </p>
            <p className="mt-1 text-xs text-slate-600">Notas: {selectedRequest.notes || "Sem observacao"}</p>
            <p className="mt-1 text-xs text-slate-600">
              De: {getRequestUserName(selectedRequest.fromUserId, selectedRequest.fromUserName, "N/A")}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Para: {getRequestUserName(selectedRequest.toUserId, selectedRequest.toUserName, "N/A")}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Status: <span className="font-semibold">{getStatusLabel(selectedRequest.status)}</span>
            </p>

            <div className="mt-3">
              <p className="text-sm font-semibold text-slate-900">Itens</p>
              {selectedRequest.items.length === 0 ? (
                <p className="mt-1 text-xs text-slate-600">Sem itens associados.</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {selectedRequest.items.map((item) => (
                    <li key={item.productId} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      {item.productName} - Quantidade: {item.quantity}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {responseError ? <p className="mt-3 text-sm text-red-700">{responseError}</p> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeResponsePopup}
                disabled={responseLoading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Fechar
              </button>

              {selectedRequest.status === "pending" ? (
                <>
                  <button
                    type="button"
                    onClick={() => respondToRequest("reject")}
                    disabled={responseLoading}
                    className="rounded-lg border border-rose-500 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:bg-rose-100"
                  >
                    Rejeitar
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToRequest("approve")}
                    disabled={responseLoading}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition disabled:bg-slate-400"
                  >
                    {responseLoading ? "Processando..." : "Aprovar"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default ApprovalsPageContent;
