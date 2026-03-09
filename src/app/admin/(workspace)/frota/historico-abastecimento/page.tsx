"use client";

import { useEffect, useState } from "react";
import { getStoredAuthToken } from "@/presentation/components/admin/AdminAuthGuard";

type FuelingUser = {
  id: number;
  name: string;
  email: string;
};

type FuelingVehicle = {
  id: number;
  plate: string;
  model: string;
  brand: string;
};

type Fueling = {
  id: number;
  vehicleId: number;
  userId: number;
  fueledAt: string;
  currentMileage: number;
  type: string;
  liters: number;
  totalAmount: number;
  pricePerLiter: number;
  station: string | null;
  notes: string | null;
  odometerImagePath: string | null;
  invoiceImagePath: string | null;
  createdAt: string;
  updatedAt: string;
  user: FuelingUser | null;
  vehicle: FuelingVehicle | null;
};

export default function AdminHistoricoAbastecimentoPage() {
  const [fuelings, setFuelings] = useState<Fueling[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFueling, setSelectedFueling] = useState<Fueling | null>(null);

  const authHeader = () => {
    const token = getStoredAuthToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  };

  const fetchFuelings = async () => {
    const header = authHeader();
    if (!header) {
      setError("Token nao encontrado. Faca login novamente.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/fuelings", {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...header,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar historico (${response.status})`);
      }

      const payload = (await response.json()) as { ok?: boolean; fuelings?: Fueling[] };
      if (payload?.ok === false || !Array.isArray(payload.fuelings)) {
        throw new Error("Resposta invalida da API de abastecimentos.");
      }

      setFuelings(payload.fuelings);
      setError(null);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar historico.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFuelings();
  }, []);

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-cyan-100">Historico de abastecimento</h2>
      <p className="text-sm text-slate-300">Consumo e abastecimentos registrados para os veiculos da frota.</p>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-900/20 px-4 py-2 text-sm text-rose-100">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-300">Carregando historico...</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800/70">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Veiculo</th>
              <th className="px-3 py-2 text-left">Motorista</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Litros</th>
              <th className="px-3 py-2 text-left">Valor/Litro</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">KM</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Obs</th>
            </tr>
          </thead>
          <tbody>
            {fuelings.map((fueling) => (
              <tr
                key={fueling.id}
                className="cursor-pointer border-t border-slate-800 transition hover:bg-slate-800/30"
                onClick={() => setSelectedFueling(fueling)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setSelectedFueling(fueling);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <td className="px-3 py-2">{fueling.id}</td>
                <td className="px-3 py-2">
                  {fueling.vehicle ? `${fueling.vehicle.plate} - ${fueling.vehicle.model}` : `ID ${fueling.vehicleId}`}
                </td>
                <td className="px-3 py-2">{fueling.user?.name || `ID ${fueling.userId}`}</td>
                <td className="px-3 py-2">{fueling.type}</td>
                <td className="px-3 py-2">{fueling.liters}</td>
                <td className="px-3 py-2">{fueling.pricePerLiter}</td>
                <td className="px-3 py-2">R$ {fueling.totalAmount}</td>
                <td className="px-3 py-2">{fueling.currentMileage}</td>
                <td className="px-3 py-2">{new Date(fueling.fueledAt).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-2">{fueling.notes || "-"}</td>
              </tr>
            ))}

            {!loading && fuelings.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={10}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!selectedFueling ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold text-cyan-100">
              Detalhes do abastecimento #{selectedFueling.id}
            </h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>
                <span className="text-slate-400">Veiculo:</span> {selectedFueling.vehicle?.plate || `ID ${selectedFueling.vehicleId}`} -{" "}
                {selectedFueling.vehicle?.model || ""}
              </p>
              <p>
                <span className="text-slate-400">Motorista:</span> {selectedFueling.user?.name || `ID ${selectedFueling.userId}`}
              </p>
              <p>
                <span className="text-slate-400">Combustivel:</span> {selectedFueling.type}
              </p>
              <p>
                <span className="text-slate-400">Data:</span> {new Date(selectedFueling.fueledAt).toLocaleString("pt-BR")}
              </p>
              <p>
                <span className="text-slate-400">Litros:</span> {selectedFueling.liters}
              </p>
              <p>
                <span className="text-slate-400">Valor litro:</span> R$ {selectedFueling.pricePerLiter}
              </p>
              <p>
                <span className="text-slate-400">Total:</span> R$ {selectedFueling.totalAmount}
              </p>
              <p>
                <span className="text-slate-400">KM atual:</span> {selectedFueling.currentMileage}
              </p>
              <p>
                <span className="text-slate-400">Posto:</span> {selectedFueling.station || "-"}
              </p>
              <p>
                <span className="text-slate-400">Observacao:</span> {selectedFueling.notes || "-"}
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-cyan-100">Documentos anexados</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-slate-400">Odometro</p>
                  {selectedFueling.odometerImagePath ? (
                    <>
                      <a
                        href={selectedFueling.odometerImagePath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-lg bg-cyan-400/20 px-3 py-2 text-xs text-cyan-100"
                      >
                        Abrir documento
                      </a>
                      <img
                        src={selectedFueling.odometerImagePath}
                        alt="Odometro"
                        className="mt-2 max-h-52 w-full rounded-lg border border-slate-700 object-cover"
                        onError={(event) => {
                          const target = event.currentTarget as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">Nenhum arquivo anexado</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-400">Nota fiscal</p>
                  {selectedFueling.invoiceImagePath ? (
                    <>
                      <a
                        href={selectedFueling.invoiceImagePath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-lg bg-cyan-400/20 px-3 py-2 text-xs text-cyan-100"
                      >
                        Abrir documento
                      </a>
                      <img
                        src={selectedFueling.invoiceImagePath}
                        alt="Nota fiscal"
                        className="mt-2 max-h-52 w-full rounded-lg border border-slate-700 object-cover"
                        onError={(event) => {
                          const target = event.currentTarget as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">Nenhum arquivo anexado</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedFueling(null)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
