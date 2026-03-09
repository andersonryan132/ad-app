"use client";

import { FormEvent, useEffect, useState } from "react";
import { getStoredAuthToken } from "@/presentation/components/admin/AdminAuthGuard";

type UserItem = {
  id: number;
  name: string;
  email: string;
  role: "adm" | "tec" | "aumoxarifado";
  userSgp: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type UserRole = {
  value: UserItem["role"];
  label: string;
};

type UserCreateForm = {
  name: string;
  role: UserItem["role"];
  email: string;
  password: string;
  userSgp: string;
  isActive: boolean;
};

const roleOptions: UserRole[] = [
  { label: "Administrador", value: "adm" },
  { label: "Tecnico", value: "tec" },
  { label: "Estoque", value: "aumoxarifado" },
];

const getRoleLabel = (role: UserItem["role"]) => roleOptions.find((option) => option.value === role)?.label || role;

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [devActionMessage, setDevActionMessage] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<UserCreateForm>({
    name: "",
    role: "adm",
    email: "",
    password: "",
    userSgp: "",
    isActive: true,
  });

  const getAuthHeader = () => {
    const token = getStoredAuthToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  };

  const fetchUsers = async () => {
    const authHeader = getAuthHeader();

    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/users", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...authHeader,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar usuarios (${response.status})`);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openDevActionMessage = (message: string) => {
    setDevActionMessage(message);
  };

  const handleOpenCreate = () => {
    setForm({
      name: "",
      role: "adm",
      email: "",
      password: "",
      userSgp: "",
      isActive: true,
    });
    setSuccess(null);
    setError(null);
    setDevActionMessage(null);
    setIsCreateOpen(true);
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();

    const authHeader = getAuthHeader();
    if (!authHeader) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.userSgp.trim()) {
      setError("Preencha name, email, senha e usuario SGP para cadastrar.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role,
          email: form.email.trim(),
          password: form.password,
          userSgp: form.userSgp.trim(),
          isActive: form.isActive,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new Error(responseText || `Erro ao criar usuario (${response.status})`);
      }

      const responseBody = (await response.json()) as { ok?: boolean };
      if (responseBody?.ok === false) {
        throw new Error("API rejeitou o cadastro de usuario.");
      }

      setSuccess("Usuario criado com sucesso!");
      setIsCreateOpen(false);
      await fetchUsers();
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao criar usuario.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-cyan-100">Gerenciamento de usuarios</h2>
          <p className="text-sm text-slate-300">Lista e cadastro de usuarios via API.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300"
        >
          + Cadastrar usuario
        </button>
      </div>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-900/20 px-4 py-2 text-sm text-rose-100">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-100">{success}</p> : null}

      {loading ? (
        <p className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">Carregando usuarios...</p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950/80">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/60">
            <tr>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Cargo</th>
              <th className="px-3 py-2 text-left">SGP</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{user.name}</td>
                <td className="px-3 py-2 text-slate-300">{user.email}</td>
                <td className="px-3 py-2">{getRoleLabel(user.role)}</td>
                <td className="px-3 py-2">{user.userSgp}</td>
                <td className="px-3 py-2">{user.isActive ? "Ativo" : "Inativo"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => openDevActionMessage(`A funcao de alterar o usuario ${user.name} esta em desenvolvimento.`)}
                    className="mr-2 rounded bg-amber-400/20 px-2 py-1 text-xs text-amber-200 transition hover:bg-amber-300/30"
                  >
                    Alterar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openDevActionMessage(`A funcao ${user.isActive ? "desativar" : "reativar"} o usuario ${user.name} esta em desenvolvimento.`)
                    }
                    className="rounded bg-cyan-400/20 px-2 py-1 text-xs text-cyan-200 transition hover:bg-cyan-300/30"
                  >
                    {user.isActive ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={6}>
                  Nenhum usuario encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!isCreateOpen ? null : (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3">
          <form
            onSubmit={submitCreate}
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-cyan-100">Cadastrar usuario</h3>
            <p className="mt-1 text-sm text-slate-300">
              Campos obrigatorios: nome, email, senha e usuario SGP (vinculado para integracao externa). Funcao conforme select.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-300">Nome</label>
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Nome"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Cargo</label>
                <select
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  value={form.role}
                  onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserItem["role"] }))}
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Usuario SGP <span className="text-rose-300">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  value={form.userSgp}
                  onChange={(event) => setForm((prev) => ({ ...prev, userSgp: event.target.value }))}
                  placeholder="usuario_sgp"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-300">Email</label>
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  type="email"
                  placeholder="email@adtelecom.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-slate-300">Senha</label>
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  type="password"
                  placeholder="Senha provisoria"
                />
              </div>

              <label className="mt-1 flex items-center justify-between rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white sm:col-span-2">
                <span>Ativo</span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100"
                disabled={saving}
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!devActionMessage ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center">
            <p className="text-sm text-rose-100">Funcionalidade em desenvolvimento</p>
            <p className="mt-2 text-sm text-slate-200">{devActionMessage}</p>
            <button
              type="button"
              onClick={() => setDevActionMessage(null)}
              className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Fechar
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
