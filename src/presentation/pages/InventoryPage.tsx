"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TIMESTAMP_KEY = "auth_token_created_at";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_SERVER ?? "http://localhost:8000";
const INVENTORY_ENDPOINT = `${API_BASE_URL.replace(/\/$/, "")}/inventory/me`;
const USERS_NAMES_ENDPOINT = `${API_BASE_URL.replace(/\/$/, "")}/users/names`;
const TRANSFER_REQUESTS_ENDPOINT = `${API_BASE_URL.replace(/\/$/, "")}/inventory/transfer-requests`;

type InventoryItem = {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
};

type InventoryResponse = {
  ok: boolean;
  total?: number;
  stock?: unknown;
  message?: string;
};

type UserNameItem = {
  id: number;
  name: string;
};

type UsersNamesResponse = {
  ok: boolean;
  users?: unknown;
  message?: string;
};

type TransferItem = {
  productId: number;
  quantity: number;
};

type TransferRequestPayload = {
  requestType: "assign" | "return";
  toUserId?: number;
  items: TransferItem[];
  notes: string;
};

type InventoryFormItem = {
  productId: string;
  quantity: string;
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

const toNumber = (value: unknown): number => Number.parseInt(String(value ?? 0), 10) || 0;

const normalizeInventoryItem = (value: unknown): InventoryItem | null => {
  if (!isObject(value)) return null;

  return {
    productId: toNumber(value.productId),
    productName: String(value.productName ?? "Produto sem nome"),
    sku: String(value.sku ?? "N/A"),
    quantity: toNumber(value.quantity),
    reservedQuantity: toNumber(value.reservedQuantity),
  };
};

const getInventoryList = (payload: InventoryResponse): unknown[] | null =>
  Array.isArray(payload.stock) ? payload.stock : null;

const normalizeUser = (value: unknown): UserNameItem | null => {
  if (!isObject(value)) return null;
  const id = Number.parseInt(String(value.id ?? 0), 10);
  if (!Number.isFinite(id)) return null;
  return { id, name: String(value.name ?? "") };
};

function InventoryPageContent() {
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<UserNameItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenExpired, setTokenExpired] = useState(false);
  const [showRequestPopup, setShowRequestPopup] = useState(false);
  const [requestType, setRequestType] = useState<"assign" | "return">("assign");
  const [toUserId, setToUserId] = useState("");
  const [notes, setNotes] = useState("");
  const [formItems, setFormItems] = useState<InventoryFormItem[]>([{ productId: "", quantity: "" }]);
  const [formError, setFormError] = useState("");

  const redirectToLogin = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
    }
    router.replace("/");
  };

  const loadUsers = async (token: string) => {
    const response = await fetch(USERS_NAMES_ENDPOINT, {
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

    const payload = (await response.json()) as UsersNamesResponse;
    if (!payload.ok || !Array.isArray(payload.users)) {
      throw new Error(payload.message || "Resposta de usuarios invalida.");
    }
    setUsers(payload.users.map(normalizeUser).filter((user): user is UserNameItem => user !== null));
  };

  useEffect(() => {
    if (tokenExpired) {
      redirectToLogin();
      return;
    }

    const loadInventory = async () => {
      setLoading(true);
      setError("");

      const token = getAuthToken();
      if (!token) {
        redirectToLogin();
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(INVENTORY_ENDPOINT, {
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

        const payload = (await response.json()) as InventoryResponse;
        if (!payload.ok) {
          throw new Error(payload.message || "Resposta invalida da API");
        }

        const rawItems = getInventoryList(payload);
        if (!rawItems) {
          throw new Error("Resposta da API sem lista de itens.");
        }
        const normalized = rawItems.map(normalizeInventoryItem).filter((item): item is InventoryItem => item !== null);
        setItems(normalized);
        setTotal(payload.total ?? normalized.length);
      } catch (err) {
        const message =
          err instanceof TypeError
            ? `Falha ao conectar na API ${INVENTORY_ENDPOINT}. Verifique se o backend esta no ar e se o CORS esta habilitado.`
            : err instanceof Error
              ? err.message
              : "Falha inesperada ao carregar o inventario.";
        setError(message);
        if (tokenExpired) {
          redirectToLogin();
        }
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, [router, tokenExpired]);

  const availableQuantity = (productId: number) => {
    const item = items.find((stockItem) => stockItem.productId === productId);
    if (!item) return 0;
    const available = item.quantity - item.reservedQuantity;
    return available > 0 ? available : 0;
  };

  const closePopup = () => {
    setShowRequestPopup(false);
    setFormError("");
    setNotes("");
    setRequestType("assign");
    setToUserId("");
    setFormItems([{ productId: "", quantity: "" }]);
  };

  const openPopup = async () => {
    const token = getAuthToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    try {
      setShowRequestPopup(true);
      await loadUsers(token);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Falha ao carregar lista de usuarios para transferencia.";
      setError(message);
    }
  };

  const updateFormItem = (index: number, field: keyof InventoryFormItem, value: string) => {
    setFormItems((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addItemRow = () => {
    setFormItems((current) => [...current, { productId: "", quantity: "" }]);
  };

  const removeItemRow = (index: number) => {
    setFormItems((current) => {
      if (current.length === 1) {
        return [{ productId: "", quantity: "" }];
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const submitTransferRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = getAuthToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    if (requestType === "assign" && !toUserId) {
      setFormError("Selecione o colaborador para transferir.");
      return;
    }

    const normalizedItems = formItems
      .map((item) => {
        const productId = Number.parseInt(item.productId, 10);
        const quantity = Number.parseInt(item.quantity, 10);
        if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity <= 0) return null;
        return { productId, quantity };
      })
      .filter((item): item is TransferItem => item !== null && item.productId > 0 && item.quantity > 0);

    if (normalizedItems.length === 0) {
      setFormError("Adicione pelo menos um item com quantidade maior que zero.");
      return;
    }

    const invalidItem = formItems.find((item) => {
      const productId = Number.parseInt(item.productId, 10);
      const quantity = Number.parseInt(item.quantity, 10);
      if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity <= 0) {
        return false;
      }
      return quantity > availableQuantity(productId);
    });
    if (invalidItem) {
      setFormError("A quantidade informada nao pode ser maior que a quantidade disponivel em estoque.");
      return;
    }

    setFormLoading(true);
    setFormError("");

    const payload: TransferRequestPayload = {
      requestType,
      notes,
      items: normalizedItems,
    };
    if (requestType === "assign") {
      payload.toUserId = Number.parseInt(toUserId, 10);
    }

    try {
      const response = await fetch(TRANSFER_REQUESTS_ENDPOINT, {
        method: "POST",
        mode: "cors",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        setTokenExpired(true);
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message);
      }

      closePopup();
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Falha ao conectar para registrar a solicitacao."
          : err instanceof Error
            ? err.message
            : "Falha inesperada ao registrar solicitacao.";
      setFormError(message);
      if (tokenExpired) {
        redirectToLogin();
      }
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 pb-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Meu estoque</h1>
            <p className="mt-1 text-sm text-slate-600">Total de itens no estoque: {total}</p>
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
          {loading ? <p className="text-sm text-slate-600">Carregando itens do estoque...</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum item encontrado.</p>
          ) : null}

          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item.productId || index}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
              >
                <p className="font-semibold text-slate-900">{item.productName}</p>
                <p className="mt-1 text-xs text-slate-600">SKU: {item.sku}</p>
                <p className="text-xs text-slate-600">Produto ID: {item.productId}</p>
                <p className="text-xs text-slate-600">Quantidade: {item.quantity}</p>
                <p className="text-xs text-slate-600">Reservado: {item.reservedQuantity}</p>
                <p className="text-xs text-slate-600 font-semibold">
                  Disponivel: {Math.max(item.quantity - item.reservedQuantity, 0)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={openPopup}
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Transferir ou devolver item
        </button>
      </section>

      {showRequestPopup ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl h-[90vh] max-h-[90vh] overflow-hidden">
            <h2 className="text-lg font-semibold text-slate-900">Solicitar movimentacao de estoque</h2>
            <p className="mt-2 text-sm text-slate-600">
              Crie a solicitacao de transferencia ou devolucao para este colaborador.
            </p>

            {formError ? <p className="mt-2 text-sm text-red-700">{formError}</p> : null}

            <form className="mt-4 space-y-3 max-h-[72vh] overflow-y-auto pr-2" onSubmit={submitTransferRequest}>
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Tipo da solicitacao</span>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={requestType}
                  onChange={(event) => setRequestType(event.target.value as "assign" | "return")}
                  disabled={formLoading}
                >
                  <option value="assign">Assign (transferir para outro colaborador)</option>
                  <option value="return">Return (devolver ao almoxarifado)</option>
                </select>
              </label>

              {requestType === "assign" ? (
                <label className="block space-y-1 text-sm text-slate-700">
                  <span>Transferir para</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                    value={toUserId}
                    onChange={(event) => setToUserId(event.target.value)}
                    required={requestType === "assign"}
                    disabled={formLoading}
                  >
                    <option value="">Selecione o colaborador</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div>
                <p className="mb-1 text-sm text-slate-700">Itens da solicitacao</p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {formItems.map((row, index) => (
                    <div key={`${row.productId}-${index}`} className="rounded-lg border border-slate-200 p-2">
                      <div className="grid gap-2">
                        <label className="block space-y-1 text-xs text-slate-700">
                          <span>Produto</span>
                          <select
                            className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                            value={row.productId}
                            onChange={(event) => updateFormItem(index, "productId", event.target.value)}
                            disabled={formLoading}
                          >
                            <option value="">Selecione</option>
                            {items.map((stockItem) => (
                              <option key={stockItem.productId} value={stockItem.productId}>
                                {stockItem.productName} (Disp: {Math.max(stockItem.quantity - stockItem.reservedQuantity, 0)})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block space-y-1 text-xs text-slate-700">
                          <span>Quantidade</span>
                          <input
                            type="number"
                            min="1"
                            className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                            value={row.quantity}
                            onChange={(event) => updateFormItem(index, "quantity", event.target.value)}
                            disabled={formLoading}
                          />
                        </label>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                          disabled={formLoading}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  disabled={formLoading}
                >
                  Adicionar item
                </button>
              </div>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Observacao</span>
                <textarea
                  className="w-full min-h-24 rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={formLoading}
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closePopup}
                  disabled={formLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition disabled:bg-slate-400"
                >
                  {formLoading ? "Enviando..." : "Registrar solicitacao"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default InventoryPageContent;
