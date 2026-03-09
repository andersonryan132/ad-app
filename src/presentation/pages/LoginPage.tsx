"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SUCCESS_PATH = "/app";
const LOGIN_ENDPOINT = "/login";
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TIMESTAMP_KEY = "auth_token_created_at";
const AUTH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  const createdAt = sessionStorage.getItem(AUTH_TOKEN_TIMESTAMP_KEY);
  if (!token || !createdAt) {
    return null;
  }

  const createdAtMs = Number(createdAt);
  if (!Number.isFinite(createdAtMs)) {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
    return null;
  }

  if (Date.now() - createdAtMs > AUTH_TOKEN_TTL_MS) {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
    return null;
  }

  return token;
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInvalidCredentials, setShowInvalidCredentials] = useState(false);

  useEffect(() => {
    const existingToken = getStoredToken();
    if (existingToken) {
      router.replace(SUCCESS_PATH);
    }
  }, [router]);

  const parseError = async (response: Response) => {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setShowInvalidCredentials(true);
          setError("");
          setLoading(false);
          return;
        }

        const message = await parseError(response);
        throw new Error(message || "Falha ao autenticar. Verifique suas credenciais.");
      }

      const tokenResponse = (await response.json()) as { token?: string; access_token?: string };
      const token = tokenResponse.token ?? tokenResponse.access_token;

      if (!token) {
        throw new Error("Resposta invalida do servidor: token nao encontrado.");
      }

      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      sessionStorage.setItem(AUTH_TOKEN_TIMESTAMP_KEY, String(Date.now()));
      router.replace(SUCCESS_PATH);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Nao foi possivel conectar no endpoint de login. Verifique se o backend esta no ar e se a rota /login responde.",
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Nao foi possivel fazer login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-8 sm:px-8">
      {showInvalidCredentials ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Nao foi possivel entrar</h2>
            <p className="mt-2 text-sm text-slate-600">Usuario ou senha invalidos.</p>
            <button
              type="button"
              onClick={() => setShowInvalidCredentials(false)}
              className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur sm:p-8">
          <div className="mb-8 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">AD Telecom</p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Acesso da plataforma</h1>
            <p className="text-sm text-slate-500">Entre com seu e-mail corporativo para continuar.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">E-mail</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-900 outline-none ring-slate-300 transition focus:border-slate-900 focus:ring-2"
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="nome@empresa.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Senha</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-900 outline-none ring-slate-300 transition focus:border-slate-900 focus:ring-2"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="********"
              />
            </label>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
