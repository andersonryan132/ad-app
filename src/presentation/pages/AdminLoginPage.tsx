"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SUCCESS_PATH = "/admin/painel";
const LOGIN_ENDPOINT = "/login";
const AUTHORIZE_ROLE_ENDPOINT = "/auth/authorize-role";
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TIMESTAMP_KEY = "auth_token_created_at";
const AUTH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REQUIRED_ROLE = "adm";

type AdminAuthState = "idle" | "authorizing" | "denied";

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

const parseError = async (response: Response) => {
  try {
    const text = await response.text();
    if (!text) {
      return `Erro HTTP ${response.status} (${response.statusText})`;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json") && text.trim().startsWith("<!DOCTYPE")) {
      return `Erro HTTP ${response.status} (${response.statusText}) no endpoint ${response.url}.`;
    }

    try {
      const parsed = JSON.parse(text) as { message?: string };
      return parsed.message || text;
    } catch {
      return text.slice(0, 180);
    }
  } catch {
    return `Erro HTTP ${response.status} (${response.statusText})`;
  }
};

export default function AdminLoginPage() {
  const [state, setState] = useState<AdminAuthState>("idle");
  const [error, setError] = useState("");
  const [checkingExistingSession, setCheckingExistingSession] = useState(true);
  const router = useRouter();

  const checkAdminRole = useCallback(async (token: string) => {
    const authorizeResponse = await fetch(AUTHORIZE_ROLE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: REQUIRED_ROLE }),
    });

    if (!authorizeResponse.ok) {
      const message = await parseError(authorizeResponse);
      throw new Error(message || "Falha ao verificar permissao.");
    }

    const authorizeBody = (await authorizeResponse.json()) as {
      ok?: boolean;
      allowed?: boolean;
      role?: string;
    };

    if (!authorizeBody?.ok || !authorizeBody?.allowed) {
      throw new Error("Conta sem permissao de administrador.");
    }

    return true;
  }, []);

  useEffect(() => {
    const existingToken = getStoredToken();
    if (!existingToken) {
      setCheckingExistingSession(false);
      return;
    }

    (async () => {
      try {
        await checkAdminRole(existingToken);
        router.replace(SUCCESS_PATH);
      } catch (e) {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
        setError(e instanceof Error ? e.message : "Sessao invalida.");
        setState("denied");
      } finally {
        setCheckingExistingSession(false);
      }
    })();
  }, [checkAdminRole, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("authorizing");
    setError("");

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      setState("idle");
      return;
    }

    try {
      const loginResponse = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        if (loginResponse.status === 401) {
          throw new Error("Usuario ou senha invalidos.");
        }
        const message = await parseError(loginResponse);
        throw new Error(message || "Falha ao autenticar.");
      }

      const loginBody = (await loginResponse.json()) as {
        token?: string;
        access_token?: string;
      };
      const token = loginBody.token ?? loginBody.access_token;
      if (!token) {
        throw new Error("Resposta de autenticacao sem token.");
      }

      await checkAdminRole(token);

      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      sessionStorage.setItem(AUTH_TOKEN_TIMESTAMP_KEY, String(Date.now()));
      setState("idle");
      router.replace(SUCCESS_PATH);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Nao foi possivel conectar no backend. Verifique se a rota /login e /auth/authorize-role estao disponiveis.",
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Nao foi possivel fazer login.");
      }

      setState("denied");
    }
  };

  if (checkingExistingSession) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-zinc-900 via-blue-950 to-slate-900 px-4 py-8 text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center">
          <p className="text-sm text-cyan-200">Validando sessao...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-900 via-blue-950 to-slate-900 px-4 py-8 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-blue-200/20 bg-white/5 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Area restrita</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Acesso ADM</h1>
            <p className="mt-2 text-sm text-white/80">
              Entre com suas credenciais para entrar na area de administracao.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/80">E-mail</span>
              <input
                className="w-full rounded-xl border border-blue-300/30 bg-black/30 px-3 py-3 text-white outline-none ring-blue-300/20 transition focus:border-blue-200 focus:ring-2"
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="nome@empresa.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/80">Senha</span>
              <input
                className="w-full rounded-xl border border-blue-300/30 bg-black/30 px-3 py-3 text-white outline-none ring-blue-300/20 transition focus:border-blue-200 focus:ring-2"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                placeholder="********"
              />
            </label>

            {state === "authorizing" ? <p className="text-sm text-cyan-100">Autenticando...</p> : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            {state === "denied" ? null : null}

            <button
              type="submit"
              disabled={state === "authorizing"}
              className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900/70 disabled:text-white/60"
            >
              {state === "authorizing" ? "Validando..." : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
