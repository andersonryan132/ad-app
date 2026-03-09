"use client";

import { FormEvent, useEffect, useState } from "react";
import { getStoredAuthToken } from "@/presentation/components/admin/AdminAuthGuard";

type StockCategory = {
  id: number;
  name: string;
  description: string;
};

type StockItem = {
  id: number;
  name: string;
  sku: string;
  description: string;
  centralQuantity: number;
  centralReserved: number;
  isActive: boolean;
  categoryId: number;
};

export default function AdminEstoqueProdutosPage() {
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    categoryId: "",
    description: "",
    initialCentralQuantity: "",
  });

  const getAuthHeader = () => {
    const token = getStoredAuthToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  };

  const fetchCategories = async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    setLoadingCategories(true);
    setError(null);

    try {
      const response = await fetch("/inventory/categories", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar categorias (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean; categories?: StockCategory[] };
      if (payload?.ok === false || !Array.isArray(payload.categories)) {
        throw new Error("Resposta invalida da API de categorias.");
      }

      setCategories(payload.categories);
      if (payload.categories.length > 0 && !form.categoryId) {
        setForm((prev) => ({ ...prev, categoryId: String(payload.categories[0].id) }));
      }
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar categorias.";
      setError(message);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchProducts = async () => {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    setLoadingProducts(true);
    setError(null);

    try {
      const response = await fetch("/inventory/products", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar produtos (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean; products?: StockItem[] };
      if (payload?.ok === false || !Array.isArray(payload.products)) {
        throw new Error("Resposta invalida da API de produtos.");
      }

      setStockItems(payload.products);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar produtos.";
      setError(message);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault();
    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    const name = form.name.trim();
    const sku = form.sku.trim();
    const categoryId = Number(form.categoryId);
    const quantity = Number(form.initialCentralQuantity);

    if (!name || !sku || !categoryId || !Number.isFinite(quantity) || quantity < 0) {
      setError("Preencha nome, sku, categoria e quantidade inicial valida.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/inventory/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          name,
          sku,
          categoryId,
          description: form.description.trim(),
          initialCentralQuantity: quantity,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new Error(responseText || `Erro ao cadastrar produto (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean };
      if (payload?.ok === false) {
        throw new Error("API rejeitou o cadastro de produto.");
      }

      setSuccess("Produto cadastrado com sucesso!");
      setForm((prev) => ({ ...prev, name: "", sku: "", description: "", initialCentralQuantity: "" }));
      await fetchProducts();
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao cadastrar produto.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const getCategoryName = (categoryId: number) => categories.find((item) => item.id === categoryId)?.name || "";

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-cyan-100">Cadastrar produto no estoque</h2>
      <p className="text-sm text-slate-300">Tela dedicada para cadastrar e consultar produtos do inventario.</p>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-900/20 px-4 py-2 text-sm text-rose-100">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-100">{success}</p> : null}

      <form onSubmit={submitProduct} className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 md:grid-cols-2 xl:grid-cols-3">
        <input
          className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
          placeholder="Nome do produto"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <input
          className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
          placeholder="SKU"
          value={form.sku}
          onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
        />
        <select
          className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
          value={form.categoryId}
          onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
          disabled={loadingCategories}
        >
          {categories.length === 0 ? <option value="">Nenhuma categoria</option> : null}
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
          placeholder="Descricao"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        />
        <input
          className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
          placeholder="Quantidade inicial no central"
          type="number"
          value={form.initialCentralQuantity}
          onChange={(event) => setForm((prev) => ({ ...prev, initialCentralQuantity: event.target.value }))}
        />
        <div className="md:col-span-2 xl:col-span-1">
          <button
            type="submit"
            disabled={saving || categories.length === 0}
            className="w-full rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            Cadastrar produto
          </button>
        </div>
      </form>

      {loadingProducts ? <p className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">Carregando produtos...</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950/80">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Categoria</th>
              <th className="px-3 py-2 text-left">Descricao</th>
              <th className="px-3 py-2 text-left">Quantidade central</th>
              <th className="px-3 py-2 text-left">Reservado</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {stockItems.map((item) => (
              <tr key={item.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2 text-slate-300">{item.sku}</td>
                <td className="px-3 py-2 text-slate-300">{getCategoryName(item.categoryId)}</td>
                <td className="px-3 py-2 text-slate-300">{item.description}</td>
                <td className="px-3 py-2">{item.centralQuantity}</td>
                <td className="px-3 py-2">{item.centralReserved}</td>
                <td className="px-3 py-2">{item.isActive ? "Ativo" : "Inativo"}</td>
              </tr>
            ))}
            {!loadingProducts && stockItems.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={7}>
                  Nenhum produto encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
