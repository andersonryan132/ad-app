"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LOGIN_PAGE_PATH = "/admin";
const AUTHORIZE_ROLE_ENDPOINT = "/auth/authorize-role";
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TIMESTAMP_KEY = "auth_token_created_at";
const AUTH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const getStoredAuthToken = () => {
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

type AuthState = "checking" | "forbidden" | "ok";

export default function AdminAuthGuard({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const router = useRouter();

  useEffect(() => {
    const verifyAccess = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        router.replace(LOGIN_PAGE_PATH);
        return;
      }

      try {
        const response = await fetch(AUTHORIZE_ROLE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: "adm" }),
        });

        if (!response.ok) {
          throw new Error("Sem permissao para acesso administrativo.");
        }

        const responseBody = (await response.json()) as { ok?: boolean; allowed?: boolean };
        if (!responseBody?.ok || !responseBody?.allowed) {
          throw new Error("Sem permissao para acesso administrativo.");
        }

        setAuthState("ok");
      } catch {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
        setAuthState("forbidden");
        setTimeout(() => router.replace(LOGIN_PAGE_PATH), 1600);
      }
    };

    verifyAccess();
  }, [router]);

  if (authState === "checking") {
    return <p className="min-h-screen bg-slate-950 p-8 text-white">Validando permissao ADM...</p>;
  }

  if (authState === "forbidden") {
    return (
      <main className="min-h-screen bg-slate-950 p-4 text-white">
        <div className="mx-auto flex min-h-[100vh] max-w-xl items-center justify-center px-4">
          <section className="w-full rounded-2xl border border-rose-300/30 bg-rose-900/30 p-6">
            <p className="text-sm font-semibold text-rose-200">Acesso negado</p>
            <p className="mt-2 text-sm text-rose-100/90">Voce nao possui permissao de ADM. Redirecionando...</p>
          </section>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
