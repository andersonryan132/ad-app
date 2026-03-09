"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStoredAuthToken } from "@/presentation/components/admin/AdminAuthGuard";

type ProductItem = {
  id: number;
  name: string;
  sku: string;
  description: string;
  centralQuantity: number;
};

type UserItem = {
  id: number;
  name: string;
  isActive: boolean;
};

type TransferItemInput = {
  productId: number;
  quantity: string;
};

type TransferItemOutput = {
  productId: number;
  productName: string;
  quantity: number;
};

type TransferRequest = {
  id: number;
  requestType: "assign" | "return";
  status: "pending" | "approved" | "rejected" | string;
  notes: string;
  fromUserId: number;
  fromUserName: string;
  toUserId: number | null;
  toUserName: string | null;
  requestedById: number;
  requestedByName: string;
  approvedById: number | null;
  createdAt: string;
  items: TransferItemOutput[];
};

type RequestTypeFilter = "all" | "assign" | "return";

export default function AdminEstoqueDistribuirPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [requests, setRequests] = useState<TransferRequest[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionRequest, setActionRequest] = useState<TransferRequest | null>(null);
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>("all");

  const [form, setForm] = useState({
    toUserId: "",
    notes: "",
    items: [] as TransferItemInput[],
  });

  const activeUsers = useMemo(() => users.filter((item) => item.isActive), [users]);
  const stockProductMap = useMemo(() => {
    const map = new Map<number, ProductItem>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const filteredRequests = useMemo(() => {
    if (requestTypeFilter === "all") return requests;
    return requests.filter((item) => item.requestType === requestTypeFilter);
  }, [requests, requestTypeFilter]);

  const getAuthHeader = () => {
    const token = getStoredAuthToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  };

  const fetchProducts = async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    setLoadingProducts(true);
    try {
      const response = await fetch("/inventory/products", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeader,
        },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Erro ao carregar produtos (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean; products?: ProductItem[] };
      if (payload?.ok === false || !Array.isArray(payload.products)) {
        throw new Error("Resposta invalida da API de produtos.");
      }
      setProducts(payload.products);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar produtos.";
      setError(message);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchUsers = async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    setLoadingUsers(true);
    try {
      const response = await fetch("/users", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeader,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar usuarios (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean; users?: UserItem[] };
      if (payload?.ok === false || !Array.isArray(payload.users)) {
        throw new Error("Resposta invalida da API de usuarios.");
      }
      setUsers(payload.users);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar usuarios.";
      setError(message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRequests = async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    setLoadingRequests(true);
    try {
      const response = await fetch("/inventory/transfer-requests", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeader,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar solicitacoes (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean; requests?: TransferRequest[] };
      if (payload?.ok === false || !Array.isArray(payload.requests)) {
        throw new Error("Resposta invalida da API de solicitacoes.");
      }
      setRequests(payload.requests);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar solicitacoes.";
      setError(message);
    } finally {
      setLoadingRequests(false);
    }
  };

  const reloadAll = async () => {
    await Promise.all([fetchProducts(), fetchUsers(), fetchRequests()]);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const addItem = () => {
    if (!products.length) {
      setError("Sem produtos cadastrados para adicionar.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { productId: products[0].id, quantity: "1" }],
    }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const updateItem = (index: number, patch: Partial<TransferItemInput>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();

    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    if (!form.toUserId) {
      setError("Selecione o usuario destino.");
      return;
    }

    if (!form.items.length) {
      setError("Adicione ao menos um item.");
      return;
    }

    const toUserId = Number(form.toUserId);
    if (!toUserId) {
      setError("Usuario destino invalido.");
      return;
    }

    const parsedItems = form.items.map((item) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
    }));

    const hasInvalid = parsedItems.some(
      (item) => !Number.isFinite(item.productId) || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.quantity),
    );
    if (hasInvalid) {
      setError("Todos os itens precisam ter produto valido e quantidade valida.");
      return;
    }

    const hasInsufficientStock = parsedItems.some((item) => {
      const product = stockProductMap.get(item.productId);
      return !product || item.quantity > product.centralQuantity;
    });

    if (hasInsufficientStock) {
      setError("Algum item possui quantidade maior que o estoque disponivel.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/inventory/transfer-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeader,
        },
        cache: "no-store",
        body: JSON.stringify({
          requestType: "assign",
          toUserId,
          items: parsedItems,
          notes: form.notes.trim(),
        }),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new Error(responseText || `Erro ao criar solicitacao (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean };
      if (payload?.ok === false) {
        throw new Error("API rejeitou a criacao da solicitacao.");
      }

      setSuccess("Solicitacao criada com sucesso.");
      setForm({ toUserId: "", notes: "", items: [] });
      await fetchRequests();
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao criar solicitacao.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const answerRequest = async (requestId: number, action: "approve" | "reject") => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    setAnswering(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/inventory/transfer-requests/${requestId}/${action}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...authHeader,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new Error(responseText || `Erro ao ${action} solicitacao (${response.status})`);
      }

      setSuccess(`Solicitacao ${action === "approve" ? "aprovada" : "rejeitada"} com sucesso.`);
      setActionRequest(null);
      await fetchRequests();
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao responder solicitacao.";
      setError(message);
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-cyan-100">Distribuicao e aprovacao de solicitacoes</h2>
      <p className="text-sm text-slate-300">
        Crie uma solicitacao de transferencia com tipo <span className="font-semibold text-cyan-200">assign</span> e acompanhe os status de aprovacao.
      </p>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-900/20 px-4 py-2 text-sm text-rose-100">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-100">{success}</p> : null}

      <form onSubmit={submitRequest} className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Responsavel destino</label>
            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
              value={form.toUserId}
              onChange={(event) => setForm((prev) => ({ ...prev, toUserId: event.target.value }))}
              required
            >
              <option value="">Selecione</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Notas</label>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
              placeholder="Observacoes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-cyan-100">Itens</p>
            <button
              type="button"
              onClick={addItem}
              className="rounded-lg border border-cyan-300/50 px-3 py-1 text-xs text-cyan-200"
            >
              Adicionar item
            </button>
          </div>

          <div className="space-y-2">
            {form.items.map((item, index) => (
              <div key={`${item.productId}-${index}`} className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
                <select
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  value={item.productId}
                  onChange={(event) => updateItem(index, { productId: Number(event.target.value) })}
                  disabled={loadingProducts}
                >
                  {!loadingProducts && products.length === 0 ? <option value={item.productId}>Sem produtos</option> : null}
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku}) - disp: {product.centralQuantity}
                    </option>
                  ))}
                </select>
                <div className="grid gap-1 text-xs text-slate-400">
                  <span>Disponivel: {stockProductMap.get(item.productId)?.centralQuantity ?? 0}</span>
                  <input
                    className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: event.target.value })}
                    placeholder="Quantidade"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-lg bg-rose-400/20 px-3 py-2 text-sm text-rose-200"
                >
                  Remover
                </button>
              </div>
            ))}

            {form.items.length === 0 ? <p className="text-sm text-slate-400">Nenhum item adicionado.</p> : null}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || loadingProducts || loadingUsers}
            className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {saving ? "Enviando..." : "Solicitar transferencia"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
        <h3 className="text-lg font-semibold text-cyan-100">Solicitacoes</h3>
        <div className="mt-1 flex flex-wrap gap-3">
          <p className="text-sm text-slate-300">{loadingRequests ? "Carregando solicitacoes..." : `${filteredRequests.length} solicitacao(oes) encontradas.`}</p>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Filtrar por tipo</label>
            <select
              className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
              value={requestTypeFilter}
              onChange={(event) => setRequestTypeFilter(event.target.value as RequestTypeFilter)}
            >
              <option value="all">Todos</option>
              <option value="assign">assign</option>
              <option value="return">return</option>
            </select>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">De</th>
                <th className="px-3 py-2 text-left">Para</th>
                <th className="px-3 py-2 text-left">Solicitado por</th>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">{request.id}</td>
                  <td className="px-3 py-2">{request.requestType}</td>
                  <td className="px-3 py-2">{request.status}</td>
                  <td className="px-3 py-2">{request.fromUserName}</td>
                  <td className="px-3 py-2">{request.toUserName || "-"}</td>
                  <td className="px-3 py-2">{request.requestedByName}</td>
                  <td className="px-3 py-2">{new Date(request.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right">
                    {request.requestType === "return" && request.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => setActionRequest(request)}
                        className="rounded bg-cyan-400/20 px-2 py-1 text-xs text-cyan-200"
                      >
                        Responder
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loadingRequests && filteredRequests.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-400" colSpan={8}>
                    Nenhuma solicitacao encontrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {!actionRequest ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h4 className="text-lg font-semibold text-cyan-100">Solicitacao #{actionRequest.id}</h4>
            <p className="mt-1 text-sm text-slate-300">Tipo: {actionRequest.requestType}</p>
            <p className="text-sm text-slate-300">Notas: {actionRequest.notes || "Sem texto."}</p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-800/60">
                  <tr>
                    <th className="px-3 py-2 text-left">Produto ID</th>
                    <th className="px-3 py-2 text-left">Produto</th>
                    <th className="px-3 py-2 text-left">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {actionRequest.items.map((item) => (
                    <tr key={`${actionRequest.id}-${item.productId}`} className="border-t border-slate-800">
                      <td className="px-3 py-2">{item.productId}</td>
                      <td className="px-3 py-2 text-slate-300">{item.productName}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionRequest(null)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => answerRequest(actionRequest.id, "reject")}
                disabled={answering}
                className="rounded-lg bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                Reprovar
              </button>
              <button
                type="button"
                onClick={() => answerRequest(actionRequest.id, "approve")}
                disabled={answering}
                className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
