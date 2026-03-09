"use client";

import { FormEvent, useEffect, useState } from "react";
import { getStoredAuthToken } from "@/presentation/components/admin/AdminAuthGuard";

type VehicleUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type Vehicle = {
  id: number;
  plate: string;
  model: string;
  color: string;
  type: string;
  year: number;
  brand: string;
  fuel: string;
  mileage: number;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
  user: VehicleUser | null;
};

type VehicleForm = {
  placa: string;
  modelo: string;
  cor: string;
  tipo: string;
  ano: string;
  marca: string;
  combustivel: string;
  kmAtual: string;
};

export default function AdminCadastroVeiculoPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<VehicleForm>({
    placa: "",
    modelo: "",
    cor: "",
    tipo: "hatch",
    ano: "",
    marca: "",
    combustivel: "flex",
    kmAtual: "",
  });

  const authHeader = () => {
    const token = getStoredAuthToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  };

  const clearMessages = () => {
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);
  };

  const fetchVehicles = async () => {
    const header = authHeader();
    if (!header) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/vehicles", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...header,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar veiculos (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean; vehicles?: Vehicle[] };
      if (payload?.ok === false || !Array.isArray(payload.vehicles)) {
        throw new Error("Resposta invalida da API de veiculos.");
      }
      setVehicles(payload.vehicles);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar veiculos.";
      setError(message);
      clearMessages();
    } finally {
      setLoading(false);
    }
  };

  const createVehicle = async (event: FormEvent) => {
    event.preventDefault();

    const header = authHeader();
    if (!header) {
      setError("Token nao encontrado. Faça login novamente.");
      return;
    }

    if (!form.placa.trim() || !form.modelo.trim() || !form.cor.trim() || !form.tipo.trim() || !form.ano.trim() || !form.marca.trim() || !form.combustivel.trim()) {
      setError("Preencha todos os campos obrigatorios.");
      return;
    }

    const body = {
      placa: form.placa.trim(),
      modelo: form.modelo.trim(),
      cor: form.cor.trim(),
      tipo: form.tipo.trim(),
      ano: Number(form.ano),
      marca: form.marca.trim(),
      combustivel: form.combustivel.trim(),
      kmAtual: Number(form.kmAtual),
    };

    if (!Number.isFinite(body.ano) || !Number.isFinite(body.kmAtual) || body.ano <= 1900 || body.kmAtual < 0) {
      setError("Ano e KM atual precisam ser valores validos.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...header,
        },
        cache: "no-store",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new Error(responseText || `Erro ao cadastrar veiculo (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean; vehicle?: Vehicle };
      if (payload?.ok === false) {
        throw new Error("API rejeitou o cadastro do veiculo.");
      }

      if (payload.vehicle) {
        setVehicles((prev) => [payload.vehicle as Vehicle, ...prev]);
      } else {
        await fetchVehicles();
      }

      setSuccess("Veiculo cadastrado com sucesso.");
      clearMessages();
      setOpenModal(false);
      setForm({
        placa: "",
        modelo: "",
        cor: "",
        tipo: "hatch",
        ano: "",
        marca: "",
        combustivel: "flex",
        kmAtual: "",
      });
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao cadastrar veiculo.";
      setError(message);
      clearMessages();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-cyan-100">Cadastrar veiculo</h2>
      <p className="text-sm text-slate-300">Gerencie as entradas da frota pela API.</p>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-900/20 px-4 py-2 text-sm text-rose-100">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-900/20 px-4 py-2 text-sm text-emerald-100">{success}</p> : null}

      <div className="flex justify-between items-start gap-3">
        <p className="text-sm text-slate-300">
          {loading ? "Carregando veiculos..." : `${vehicles.length} veiculo(s) encontrado(s).`}
        </p>
        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Cadastrar veiculo
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/70">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Placa</th>
              <th className="px-3 py-2 text-left">Modelo</th>
              <th className="px-3 py-2 text-left">Marca</th>
              <th className="px-3 py-2 text-left">Cor</th>
              <th className="px-3 py-2 text-left">Ano</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Combustivel</th>
              <th className="px-3 py-2 text-left">KM</th>
              <th className="px-3 py-2 text-left">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{vehicle.id}</td>
                <td className="px-3 py-2">{vehicle.plate}</td>
                <td className="px-3 py-2">{vehicle.model}</td>
                <td className="px-3 py-2">{vehicle.brand}</td>
                <td className="px-3 py-2">{vehicle.color}</td>
                <td className="px-3 py-2">{vehicle.year}</td>
                <td className="px-3 py-2">{vehicle.type}</td>
                <td className="px-3 py-2">{vehicle.fuel}</td>
                <td className="px-3 py-2">{vehicle.mileage}</td>
                <td className="px-3 py-2">{vehicle.user?.name || "-"}</td>
              </tr>
            ))}
            {!loading && vehicles.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={9}>
                  Nenhum veiculo encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!openModal ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-cyan-100">Novo veiculo</h3>
            <form onSubmit={createVehicle} className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-xs text-slate-300">Placa</label>
                <input
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  placeholder="ABC1234"
                  value={form.placa}
                  onChange={(event) => setForm((prev) => ({ ...prev, placa: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-300">Modelo</label>
                <input
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  placeholder="traker"
                  value={form.modelo}
                  onChange={(event) => setForm((prev) => ({ ...prev, modelo: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-300">Cor</label>
                <input
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  placeholder="Prata"
                  value={form.cor}
                  onChange={(event) => setForm((prev) => ({ ...prev, cor: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-300">Tipo</label>
                <select
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  value={form.tipo}
                  onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
                >
                  <option value="hatch">hatch</option>
                  <option value="sedan">sedan</option>
                  <option value="suv">suv</option>
                  <option value="pickup">pickup</option>
                  <option value="van">van</option>
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-300">Ano</label>
                <input
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  placeholder="2020"
                  value={form.ano}
                  type="number"
                  min="1900"
                  onChange={(event) => setForm((prev) => ({ ...prev, ano: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-300">Marca</label>
                <input
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  placeholder="Chevrolet"
                  value={form.marca}
                  onChange={(event) => setForm((prev) => ({ ...prev, marca: event.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-300">Combustivel</label>
                <select
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  value={form.combustivel}
                  onChange={(event) => setForm((prev) => ({ ...prev, combustivel: event.target.value }))}
                >
                  <option value="flex">flex</option>
                  <option value="gasolina">gasolina</option>
                  <option value="etanol">etanol</option>
                  <option value="diesel">diesel</option>
                </select>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-slate-300">KM atual</label>
                <input
                  className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                  placeholder="1200"
                  value={form.kmAtual}
                  type="number"
                  min="0"
                  onChange={(event) => setForm((prev) => ({ ...prev, kmAtual: event.target.value }))}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
