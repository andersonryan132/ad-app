"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { getStoredAuthToken } from "@/presentation/components/admin/AdminAuthGuard";

const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const VEHICLES_READER_URL = "https://adtelecomrn.rastrosystem.com.br/api_v2/veiculos/buscar/";
const LOCATION_HISTORY_ENDPOINT = "/vehicle-location-history";
const CLIENTE_FILTRO = "DAMIAO VICENTE";

type ReaderVehicle = {
  id: number;
  veiculo_id: number;
  name: string;
  placa: string;
  cliente: string;
};

type VehiclePoint = {
  id: number;
  externalVehicleId: number;
  name: string;
  plate: string;
  latitude: number;
  longitude: number;
  capturedAt: string;
  createdAt: string;
};

type LocationResponse = {
  ok: boolean;
  pontos: unknown;
  total?: number;
  message?: string;
};

type VehicleDataMode = "history" | "realtime";

declare global {
  interface Window {
    L?: any;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseReaderAuthToken = () => {
  const token = process.env.NEXT_PUBLIC_READER_AUTH_TOKEN?.trim();
  if (!token) return null;
  return token;
};

const formatReaderAuthToken = (token: string, forceBearer: boolean) => {
  if (!token) return token;
  if (!forceBearer) return token;
  if (/^bearer\\s+/i.test(token)) return token;
  return `Bearer ${token}`;
};

const parseReaderVehicles = (payload: unknown): ReaderVehicle[] => {
  if (!isObject(payload) || !Array.isArray((payload as Record<string, unknown>).dispositivos)) {
    return [];
  }

  return (payload.dispositivos as unknown[])
    .map((item): ReaderVehicle | null => {
      if (!isObject(item)) return null;
      const id = Number(item.id);
      const veiculoId = Number(item.veiculo_id);
      if (!Number.isFinite(id) || !Number.isFinite(veiculoId)) return null;

      const cliente = String(item.cliente ?? "").trim();
      if (cliente !== CLIENTE_FILTRO) return null;

      return {
        id,
        veiculo_id: veiculoId,
        name: String(item.name ?? ""),
        placa: String(item.placa ?? ""),
        cliente,
      };
    })
    .filter((vehicle): vehicle is ReaderVehicle => vehicle !== null)
    .sort((a, b) => a.placa.localeCompare(b.placa));
};

const parseVehiclePoint = (item: unknown): VehiclePoint | null => {
  if (!isObject(item)) return null;

  const id = Number(item.id);
  const externalVehicleId = Number(item.externalVehicleId);
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  const capturedAt = String(item.capturedAt ?? "");
  const createdAt = String(item.createdAt ?? "");

  if (!Number.isFinite(id) || !Number.isFinite(externalVehicleId) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id,
    externalVehicleId,
    name: String(item.name ?? ""),
    plate: String(item.plate ?? ""),
    latitude,
    longitude,
    capturedAt,
    createdAt,
  };
};

const toIsoDate = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
};

const injectLeafletDependencies = async () => {
  if (typeof window === "undefined") return;
  if (window.L) return;

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("leaflet-css");
      if (existing) {
        resolve();
        return;
      }
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error("Falha ao carregar CSS do Leaflet."));
      document.head.appendChild(link);
    }),
    new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("leaflet-script");
      if (existing) {
        if (window.L) {
          resolve();
        } else {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error("Falha ao carregar JS do Leaflet.")), { once: true });
        }
        return;
      }
      const script = document.createElement("script");
      script.id = "leaflet-script";
      script.src = LEAFLET_JS_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Falha ao carregar JS do Leaflet."));
      document.body.appendChild(script);
    }),
  ]);
};

export default function AdminLocalizacaoTempoRealPage() {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const pollRef = useRef<number | null>(null);
  const loadingRef = useRef(false);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [vehicles, setVehicles] = useState<ReaderVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<ReaderVehicle | null>(null);
  const [mode, setMode] = useState<VehicleDataMode>("history");
  const [fromDateTime, setFromDateTime] = useState("");
  const [toDateTime, setToDateTime] = useState("");
  const [limit, setLimit] = useState(300);
  const [points, setPoints] = useState<VehiclePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMap, setLoadingMap] = useState(false);

  const loadReaderVehicles = async () => {
    const readerToken = parseReaderAuthToken();
    if (!readerToken) {
      setError("Token do leitor nao configurado no ambiente (NEXT_PUBLIC_READER_AUTH_TOKEN).");
      return;
    }

    try {
      const response = await fetch(VEHICLES_READER_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: readerToken,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401 && !readerToken.toLowerCase().startsWith("bearer ")) {
          const fallbackResponse = await fetch(VEHICLES_READER_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${readerToken}`,
            },
            cache: "no-store",
          });

          if (!fallbackResponse.ok) {
            throw new Error(`Erro ao carregar veiculos do leitor (${fallbackResponse.status})`);
          }

          const fallbackPayload = await fallbackResponse.json();
          const parsedFallback = parseReaderVehicles(fallbackPayload);
          setVehicles(parsedFallback);
          setSelectedVehicle((current) => {
            if (current && parsedFallback.some((vehicle) => vehicle.veiculo_id === current.veiculo_id)) {
              return current;
            }
            return parsedFallback[0] ?? null;
          });
          setError(null);
          return;
        }

        throw new Error(`Erro ao carregar veiculos do leitor (${response.status})`);
      }

      const payload = await response.json();
      const parsed = parseReaderVehicles(payload);
      setVehicles(parsed);
      setSelectedVehicle((current) => {
        if (current && parsed.some((vehicle) => vehicle.veiculo_id === current.veiculo_id)) {
          return current;
        }
        return parsed[0] ?? null;
      });
      setError(null);
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar veiculos.";
      setError(message);
    }
  };
 
  const adminHeaders = () => {
    const token = getStoredAuthToken();
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  };

  const queryLocationHistory = async (options: { isRealtime?: boolean; silent?: boolean }) => {
    const { isRealtime = false, silent = false } = options;

    const headers = adminHeaders();
    if (!headers) {
      if (!silent) setError("Sessao de admin expirada. Entre novamente.");
      return;
    }

    if (!selectedVehicle) {
      if (!silent) setError("Selecione um veiculo para consultar.");
      return;
    }

    if (!silent) setLoading(true);
    loadingRef.current = true;
    setError(null);

    const params = new URLSearchParams();
    params.set("veiculoId", String(selectedVehicle.veiculo_id));

    if (isRealtime) {
      params.set("latestOnly", "true");
    } else {
      const fromIso = toIsoDate(fromDateTime);
      const toIso = toIsoDate(toDateTime);

      if (fromIso) params.set("from", fromIso);
      if (toIso) params.set("to", toIso);
      const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 300, 2000));
      params.set("limit", String(safeLimit));
      if (safeLimit !== limit) setLimit(safeLimit);
    }

    if (toDateTime && fromDateTime) {
      const from = new Date(fromDateTime).getTime();
      const to = new Date(toDateTime).getTime();
      if (Number.isFinite(from) && Number.isFinite(to) && from > to) {
        if (!silent) {
          setError("Periodo invalido: 'de' nao pode ser maior que 'ate'.");
          setLoading(false);
          loadingRef.current = false;
        }
        return;
      }
    }

    try {
      const response = await fetch(`${LOCATION_HISTORY_ENDPOINT}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...headers,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Erro ao carregar localizacao (${response.status})`);
      }

      const payload = (await response.json()) as LocationResponse;
      const pointsPayload = Array.isArray(payload?.pontos) ? payload.pontos : [];
      const parsed = pointsPayload
        .map(parseVehiclePoint)
        .filter((item): item is VehiclePoint => item !== null)
        .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

      if (payload?.ok === false) {
        throw new Error(payload.message || "Resposta invalida da API de localizacao.");
      }

      if (isRealtime) {
        if (parsed.length === 0) {
          if (!silent) setError("Nenhum ponto retornado no momento.");
          return;
        }
        setPoints((current) => {
          const latest = parsed[parsed.length - 1];
          if (!current.length) {
            return [latest];
          }
          const last = current[current.length - 1];
          if (last.id === latest.id || (last.latitude === latest.latitude && last.longitude === latest.longitude)) {
            return current;
          }
          const merged = [...current, latest];
          return merged.slice(-2000);
        });
      } else {
        setPoints(parsed);
      }
    } catch (exception) {
      const message = exception instanceof Error ? exception.message : "Erro inesperado ao carregar pontos.";
      if (!silent) setError(message);
    } finally {
      if (!silent) setLoading(false);
      loadingRef.current = false;
    }
  };

  const stopRealtime = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startRealtime = () => {
    stopRealtime();
    pollRef.current = window.setInterval(() => {
      if (!loadingRef.current) {
        queryLocationHistory({ isRealtime: true, silent: true }).catch(() => null);
      }
    }, 10000);
  };

  const onSubmitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (mode === "history") {
      stopRealtime();
      queryLocationHistory({ isRealtime: false });
      return;
    }
    queryLocationHistory({ isRealtime: true }).then(() => {
      startRealtime();
    });
  };

  useEffect(() => {
    loadReaderVehicles();
  }, []);

  useEffect(() => {
    return () => {
      stopRealtime();
    };
  }, []);

  useEffect(() => {
    if (mode === "realtime" && selectedVehicle) {
      setPoints([]);
      queryLocationHistory({ isRealtime: true }).then(() => {
        startRealtime();
      });
      return;
    }
    stopRealtime();
  }, [mode, selectedVehicle?.veiculo_id]);

  useEffect(() => {
    let canceled = false;
    const initLeaflet = async () => {
      try {
        setLoadingMap(true);
        await injectLeafletDependencies();
        if (!canceled) {
          setLeafletLoaded(true);
        }
      } catch (exception) {
        const message = exception instanceof Error ? exception.message : "Falha ao carregar recursos do mapa.";
        if (!canceled) setError(message);
      } finally {
        if (!canceled) setLoadingMap(false);
      }
    };
    initLeaflet();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapHostRef.current || !points.length) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        mapReadyRef.current = false;
      }
      return;
    }

    const leaflet = window.L;
    if (!leaflet) {
      return;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      mapReadyRef.current = false;
    }

    const center = [points[0].latitude, points[0].longitude] as [number, number];
    const map = leaflet.map(mapHostRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, 15);
    mapInstanceRef.current = map;
    mapReadyRef.current = true;

    leaflet
      .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
      .addTo(map);

    const path = points.map((point) => [point.latitude, point.longitude] as [number, number]);
    if (path.length > 1) {
      const route = leaflet.polyline(path, {
        color: "#22d3ee",
        weight: 4,
        opacity: 0.95,
      }).addTo(map);
      if (path.length > 2) {
        map.fitBounds(route.getBounds(), { padding: [24, 24] });
      } else {
        map.setView(center, 14);
      }

      leaflet
        .marker(path[0], {
          title: "Inicio",
        })
        .addTo(map)
        .bindPopup("Inicio da trilha");
      leaflet
        .marker(path[path.length - 1], {
          title: "Ultima localizacao",
        })
        .addTo(map)
        .bindPopup("Ultima localizacao");
    } else if (path.length === 1) {
      leaflet.marker(path[0]).addTo(map).bindPopup("Ultima localizacao");
      map.setView(center, 14);
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      mapReadyRef.current = false;
    };
  }, [leafletLoaded, points]);

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-cyan-100">Localizacao em tempo real</h2>
      <p className="text-sm text-slate-300">Selecione um veiculo e escolha visualizacao: historico de locomocao ou tempo real.</p>

      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-900/20 px-4 py-2 text-sm text-rose-100">{error}</p> : null}

      <form onSubmit={onSubmitSearch} className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-950/80 p-4 md:grid-cols-3">
        <label className="grid gap-1">
          <span className="text-xs text-slate-300">Veiculo</span>
          <select
            className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
            value={selectedVehicle?.veiculo_id?.toString() ?? ""}
            onChange={(event) => {
              const id = Number(event.target.value);
              const match = vehicles.find((vehicle) => vehicle.veiculo_id === id) ?? null;
              setSelectedVehicle(match);
            }}
            required
          >
            {vehicles.length === 0 ? <option value="">Carregando veiculos...</option> : null}
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.veiculo_id}>
                {vehicle.placa} - {vehicle.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-slate-300">Modo</span>
          <select
            className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
            value={mode}
            onChange={(event) => setMode(event.target.value as VehicleDataMode)}
          >
            <option value="history">Historico de locomoção</option>
            <option value="realtime">Tempo real</option>
          </select>
        </label>

        {mode === "history" ? (
          <>
            <label className="grid gap-1">
              <span className="text-xs text-slate-300">De (YYYY-MM-DDTHH:mm)</span>
              <input
                type="datetime-local"
                className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                value={fromDateTime}
                onChange={(event) => setFromDateTime(event.target.value)}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-slate-300">Ate (YYYY-MM-DDTHH:mm)</span>
              <input
                type="datetime-local"
                className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                value={toDateTime}
                onChange={(event) => setToDateTime(event.target.value)}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-slate-300">Limite max de pontos (1 a 2000)</span>
              <input
                type="number"
                min={1}
                max={2000}
                className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white outline-none"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              />
            </label>
          </>
        ) : null}

        <div className="flex items-end gap-2 md:col-span-3">
          <button
            type="submit"
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
            disabled={loading || vehicles.length === 0}
          >
            {loading ? "Consultando..." : mode === "history" ? "Consultar historico" : "Iniciar tempo real"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100"
            onClick={() => {
              setMode("history");
              setFromDateTime("");
              setToDateTime("");
              setLimit(300);
              setPoints([]);
              setError(null);
            }}
          >
            Limpar
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-slate-200">
            {selectedVehicle
              ? `${selectedVehicle.placa} - ${selectedVehicle.name} (${points.length} ponto(s))`
              : "Selecione um veiculo."}
          </p>
          <p className="text-xs text-slate-400">
            Fonte: {loadingMap ? "preparando mapa..." : "OpenStreetMap"}
          </p>
        </div>

        <div
          ref={mapHostRef}
          className="h-[420px] w-full rounded-xl border border-slate-700 bg-slate-900/80"
          aria-label="Mapa da localizacao"
        />

        {!points.length && !loading ? (
          <p className="mt-3 text-sm text-slate-400">
            Nenhum ponto encontrado para o periodo selecionado.
          </p>
        ) : null}
        {loading ? <p className="mt-3 text-sm text-slate-300">Carregando localizacao...</p> : null}
      </div>
    </div>
  );
}

