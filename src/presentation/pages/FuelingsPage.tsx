"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TIMESTAMP_KEY = "auth_token_created_at";
const FUELINGS_ENDPOINT = "/fuelings";
const VEHICLES_ENDPOINT = "/vehicles";

type FuelingUser = {
  id: number;
  name: string;
  email: string;
};

type FuelingVehicle = {
  id: number;
  plate: string;
  model?: string;
  brand?: string;
};

type FuelingItem = {
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
  user: FuelingUser;
  vehicle: FuelingVehicle;
};

type FuelingsResponse = {
  ok: boolean;
  fuelings: unknown;
  message?: string;
};

type VehicleItem = {
  id: number;
  plate: string;
  model?: string;
  brand?: string;
  color?: string;
  type?: string;
  year?: number;
  fuel?: string;
  mileage?: number;
};

type VehiclesResponse = {
  ok: boolean;
  vehicles: unknown;
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

const formatDateTime = (value?: string) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR");
};

const normalizeFueling = (item: unknown): FuelingItem | null => {
  if (!isObject(item)) {
    return null;
  }

  const id = Number(item.id);
  const vehicleId = Number(item.vehicleId);
  const userId = Number(item.userId);
  const currentMileage = Number(item.currentMileage);
  const liters = Number(item.liters);
  const totalAmount = Number(item.totalAmount);
  const pricePerLiter = Number(item.pricePerLiter);

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(vehicleId) ||
    !Number.isFinite(userId) ||
    !Number.isFinite(currentMileage) ||
    !Number.isFinite(liters) ||
    !Number.isFinite(totalAmount) ||
    !Number.isFinite(pricePerLiter)
  ) {
    return null;
  }

  if (!isObject(item.user) || !isObject(item.vehicle)) {
    return null;
  }

  return {
    id,
    vehicleId,
    userId,
    fueledAt: String(item.fueledAt ?? ""),
    currentMileage,
    type: String(item.type ?? ""),
    liters,
    totalAmount,
    pricePerLiter,
    station: item.station === null ? null : String(item.station ?? ""),
    notes: item.notes === null ? null : String(item.notes ?? ""),
    odometerImagePath: item.odometerImagePath === null ? null : String(item.odometerImagePath ?? ""),
    invoiceImagePath: item.invoiceImagePath === null ? null : String(item.invoiceImagePath ?? ""),
    createdAt: String(item.createdAt ?? ""),
    updatedAt: String(item.updatedAt ?? ""),
    user: {
      id: Number((item.user as Record<string, unknown>).id ?? 0),
      name: String((item.user as Record<string, unknown>).name ?? ""),
      email: String((item.user as Record<string, unknown>).email ?? ""),
    },
    vehicle: {
      id: Number((item.vehicle as Record<string, unknown>).id ?? 0),
      plate: String((item.vehicle as Record<string, unknown>).plate ?? ""),
      model: String((item.vehicle as Record<string, unknown>).model ?? ""),
      brand: String((item.vehicle as Record<string, unknown>).brand ?? ""),
    },
  };
};

const normalizeVehicle = (item: unknown): VehicleItem | null => {
  if (!isObject(item)) {
    return null;
  }

  const id = Number(item.id ?? 0);
  if (!Number.isFinite(id)) {
    return null;
  }

  return {
    id,
    plate: String(item.plate ?? ""),
    model: String(item.model ?? ""),
    brand: String(item.brand ?? ""),
    color: String(item.color ?? ""),
    type: String(item.type ?? ""),
    year: Number(item.year ?? 0),
    fuel: String(item.fuel ?? ""),
    mileage: Number(item.mileage ?? 0),
  };
};

const nowDateTimeLocal = () => {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
};

function FuelingsPageContent() {
  const router = useRouter();

  const [fuelings, setFuelings] = useState<FuelingItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tokenExpired, setTokenExpired] = useState(false);
  const [showRegisterPopup, setShowRegisterPopup] = useState(false);

  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [fuelDateTime, setFuelDateTime] = useState("");
  const [currentMileage, setCurrentMileage] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("Gasolina");
  const [liters, setLiters] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [station, setStation] = useState("");
  const [observacao, setObservacao] = useState("");
  const [odometerImage, setOdometerImage] = useState<File | null>(null);
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const redirectToLogin = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
    }
    router.replace("/");
  };

  const loadFuelingsData = async () => {
    const token = getAuthToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    const response = await fetch(FUELINGS_ENDPOINT, {
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

    const payload = (await response.json()) as FuelingsResponse;
    if (!payload.ok) {
      throw new Error(payload.message || "Resposta invalida da API");
    }

    if (!Array.isArray(payload.fuelings)) {
      throw new Error("Resposta da API sem lista de abastecimentos.");
    }

    setFuelings(payload.fuelings.map(normalizeFueling).filter((item): item is FuelingItem => item !== null));
  };

  const loadVehiclesData = async () => {
    const token = getAuthToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    const response = await fetch(VEHICLES_ENDPOINT, {
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

    const payload = (await response.json()) as VehiclesResponse;
    if (!payload.ok) {
      throw new Error(payload.message || "Resposta invalida da API");
    }

    if (!Array.isArray(payload.vehicles)) {
      throw new Error("Resposta da API sem lista de veiculos.");
    }

    setVehicles(payload.vehicles.map(normalizeVehicle).filter((item): item is VehicleItem => item !== null));
  };

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadFuelingsData(), loadVehiclesData()]);
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Falha ao conectar na API. Verifique se o backend esta no ar e se o CORS esta habilitado."
          : err instanceof Error
            ? err.message
            : "Falha inesperada ao carregar dados.";
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

    loadData();
  }, [router, tokenExpired]);

  const clearForm = () => {
    setVehicleId("");
    setFuelDateTime("");
    setCurrentMileage("");
    setTipoCombustivel("Gasolina");
    setLiters("");
    setTotalAmount("");
    setPricePerLiter("");
    setStation("");
    setObservacao("");
    setOdometerImage(null);
    setInvoiceImage(null);
    setFormError("");
  };

  const openPopup = () => {
    setFuelDateTime(nowDateTimeLocal());
    setShowRegisterPopup(true);
    if (vehicles.length === 0) {
      loadVehiclesData().catch(() => {});
    }
  };

  const closePopup = () => {
    setShowRegisterPopup(false);
    setFormError("");
  };

  const submitRegisterForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const token = getAuthToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    if (vehicleId === "" || !fuelDateTime || !currentMileage || !liters || !totalAmount || !pricePerLiter) {
      setFormError("Preencha os campos obrigatorios.");
      return;
    }

    setFormLoading(true);
    setFormError("");

    try {
      const payload = new FormData();
      payload.append("vehicleId", String(vehicleId));
      payload.append("fuelDateTime", fuelDateTime);
      payload.append("currentMileage", currentMileage);
      payload.append("tipoCombustivel", tipoCombustivel);
      payload.append("liters", liters);
      payload.append("totalAmount", totalAmount);
      payload.append("pricePerLiter", pricePerLiter);
      if (station) payload.append("station", station);
      if (observacao) payload.append("observacao", observacao);
      if (odometerImage) payload.append("odometerImage", odometerImage);
      if (invoiceImage) payload.append("invoiceImage", invoiceImage);

      const response = await fetch(FUELINGS_ENDPOINT, {
        method: "POST",
        mode: "cors",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });

      if (response.status === 401) {
        setTokenExpired(true);
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message);
      }

      clearForm();
      setShowRegisterPopup(false);
      await loadFuelingsData();
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Falha ao conectar na API para registrar abastecimento."
          : err instanceof Error
            ? err.message
            : "Falha inesperada ao registrar abastecimento.";
      setFormError(message);
      if (tokenExpired) {
        redirectToLogin();
      }
    } finally {
      setFormLoading(false);
    }
  };

  const vehicleLabel = (fueling: FuelingItem) =>
    [fueling.vehicle.brand, fueling.vehicle.model, fueling.vehicle.plate].filter(Boolean).join(" ");

  const vehicleOptionLabel = (vehicle: VehicleItem) =>
    [vehicle.brand, vehicle.model, vehicle.plate].filter(Boolean).join(" ");

  const sortedFuelings = [...fuelings].sort((a, b) => {
    const aDate = new Date(a.createdAt).getTime();
    const bDate = new Date(b.createdAt).getTime();
    if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
      return b.id - a.id;
    }
    return bDate - aDate;
  });

  return (
    <main className="min-h-screen bg-slate-100 pb-6">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Historico de abastecimentos</h1>
            <p className="mt-1 text-sm text-slate-600">Acompanhe todos os registros de abastecimento.</p>
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
          {loading ? <p className="text-sm text-slate-600">Carregando abastecimentos...</p> : null}
          {!loading && !error && fuelings.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum abastecimento encontrado.</p>
          ) : null}

          <ul className="space-y-2">
            {sortedFuelings.map((fueling) => (
              <li key={fueling.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {vehicleLabel(fueling) || `Veiculo #${fueling.vehicleId}`} - {fueling.type}
                  </p>
                  <p className="text-xs text-slate-500">ID {fueling.id}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">Data: {formatDateTime(fueling.fueledAt)}</p>
                <p className="text-xs text-slate-600">
                  Quilometragem: {fueling.currentMileage.toLocaleString("pt-BR")} km
                </p>
                <p className="text-xs text-slate-600">
                  Litros: {fueling.liters} | Valor: R$ {fueling.totalAmount.toFixed(2)} | R$/L: R${" "}
                  {fueling.pricePerLiter.toFixed(2)}
                </p>
                <p className="text-xs text-slate-600">
                  Usuario: {fueling.user.name} ({fueling.user.email})
                </p>
                {fueling.notes ? <p className="mt-1 text-xs text-slate-600">Observacoes: {fueling.notes}</p> : null}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={openPopup}
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Registrar abastecimento
        </button>
      </section>

      {showRegisterPopup ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl h-[88vh] max-h-[88vh] overflow-hidden">
            <h2 className="text-lg font-semibold text-slate-900">Registro de abastecimento</h2>

            {formError ? <p className="mt-2 text-sm text-red-700">{formError}</p> : null}
            <form className="mt-4 max-h-[70vh] overflow-y-auto space-y-3 pr-2" onSubmit={submitRegisterForm}>
              <label className="block space-y-1 text-sm text-slate-700">
                <span>Veiculo</span>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={vehicleId}
                  onChange={(event) =>
                    setVehicleId(event.target.value ? Number.parseInt(event.target.value, 10) : "")
                  }
                  required
                  disabled={formLoading}
                >
                  <option value="">Selecione</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicleOptionLabel(vehicle)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Data e hora do abastecimento</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={fuelDateTime}
                  onChange={(event) => setFuelDateTime(event.target.value)}
                  required
                  disabled={formLoading}
                />
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Quilometragem atual</span>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={currentMileage}
                  onChange={(event) => setCurrentMileage(event.target.value)}
                  required
                  disabled={formLoading}
                />
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Tipo de combustivel</span>
                <select
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={tipoCombustivel}
                  onChange={(event) => setTipoCombustivel(event.target.value)}
                  required
                  disabled={formLoading}
                >
                  <option>Gasolina</option>
                  <option>Etanol</option>
                  <option>Disiel</option>
                </select>
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Litros</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={liters}
                  onChange={(event) => setLiters(event.target.value)}
                  required
                  disabled={formLoading}
                />
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Valor total</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={totalAmount}
                  onChange={(event) => setTotalAmount(event.target.value)}
                  required
                  disabled={formLoading}
                />
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Preço por litro</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={pricePerLiter}
                  onChange={(event) => setPricePerLiter(event.target.value)}
                  required
                  disabled={formLoading}
                />
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Posto</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={station}
                  onChange={(event) => setStation(event.target.value)}
                  disabled={formLoading}
                />
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Observacao</span>
                <textarea
                  className="w-full min-h-24 rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  value={observacao}
                  onChange={(event) => setObservacao(event.target.value)}
                  disabled={formLoading}
                />
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Imagem do odometro</span>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                    onChange={(event) => setOdometerImage(event.target.files?.[0] ?? null)}
                    disabled={formLoading}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                    onChange={(event) => setOdometerImage(event.target.files?.[0] ?? null)}
                    disabled={formLoading}
                  />
                  <p className="text-xs text-slate-500">Toque em uma das opções para escolher foto da galeria ou tirar com a câmera.</p>
                </div>
              </label>

              <label className="block space-y-1 text-sm text-slate-700">
                <span>Imagem da nota</span>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                    onChange={(event) => setInvoiceImage(event.target.files?.[0] ?? null)}
                    disabled={formLoading}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                    onChange={(event) => setInvoiceImage(event.target.files?.[0] ?? null)}
                    disabled={formLoading}
                  />
                  <p className="text-xs text-slate-500">Toque em uma das opções para escolher foto da galeria ou tirar com a câmera.</p>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closePopup}
                  disabled={formLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition disabled:bg-slate-400"
                >
                  {formLoading ? "Registrando..." : "Registrar abastecimento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default FuelingsPageContent;
