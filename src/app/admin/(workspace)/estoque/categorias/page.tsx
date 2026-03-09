"use client";

import { FormEvent, useEffect, useState } from "react";
import { getStoredAuthToken } from "@/presentation/components/admin/AdminAuthGuard";

type CategoryItem = {
  id: number;
  name: string;
  description: string;
  productsCount?: number;
};

export default function AdminEstoqueCategoriasPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

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

    setLoading(true);
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

      const payload = (await response.json()) as { ok?: boolean; categories?: CategoryItem[] };
      if (payload?.ok === false || !Array.isArray(payload?.categories)) {
        throw new Error("Resposta invalida da API de categorias.");
      }

      setCategories(payload.categories);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar categorias.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();

    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    const name = form.name.trim();
    const description = form.description.trim();
    if (!name || !description) {
      setError("Nome e descricao sao obrigatorios.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/inventory/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Erro ao criar categoria (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean };
      if (payload?.ok === false) {
        throw new Error("API rejeitou o cadastro de categoria.");
      }

      setSuccess("Categoria criada com sucesso!");
      setForm({ name: "", description: "" });
      await fetchCategories();
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao criar categoria.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-cyan-100">Criar categoria</h2>
      <p className="text-sm text-slate-300">Tela dedicada para cadastrar e listar categorias do inventario.</p>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-900/20 px-4 py-2 text-sm text-rose-100">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-100">{success}</p> : null}

      <form onSubmit={submitCategory} className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 md:grid-cols-3">
        <input
          className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
          placeholder="Nome da categoria"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
        <input
          className="md:col-span-2 rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
          placeholder="Descricao da categoria"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
        >
          Cadastrar
        </button>
      </form>

      {loading ? <p className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">Carregando categorias...</p> : null}

      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
        <p className="mb-3 text-sm text-slate-300">Categorias atuais</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Descricao</th>
                <th className="px-3 py-2 text-left">Produtos vinculados</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">{item.id}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 text-slate-300">{item.description}</td>
                  <td className="px-3 py-2">{typeof item.productsCount === "number" ? item.productsCount : 0}</td>
                </tr>
              ))}
              {!loading && categories.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-400" colSpan={4}>
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
