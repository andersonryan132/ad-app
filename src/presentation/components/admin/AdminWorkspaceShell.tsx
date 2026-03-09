"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminAuthGuard from "./AdminAuthGuard";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TIMESTAMP_KEY = "auth_token_created_at";

type MenuItem = {
  path: string;
  label: string;
  icon: string;
  accent: string;
  section: string;
};

const menuItems: MenuItem[] = [
  { path: "/admin/painel", label: "Painel", icon: "⌂", accent: "from-cyan-400/20 to-cyan-200/10", section: "Resumo" },
  { path: "/admin/usuarios", label: "Usuarios", icon: "👤", accent: "from-violet-400/25 to-fuchsia-300/5", section: "Gestao" },
  { path: "/admin/estoque/categorias", label: "Criar categoria", icon: "📁", accent: "from-blue-400/25 to-cyan-300/5", section: "Estoque" },
  { path: "/admin/estoque/produtos", label: "Produto em estoque", icon: "📦", accent: "from-sky-400/25 to-blue-300/5", section: "Estoque" },
  { path: "/admin/estoque/distribuir", label: "Distribuir funcionarios", icon: "🚚", accent: "from-fuchsia-400/25 to-pink-300/5", section: "Estoque" },
  { path: "/admin/frota/cadastrar-veiculo", label: "Cadastrar veiculo", icon: "🚗", accent: "from-emerald-400/25 to-teal-300/5", section: "Frota" },
  {
    path: "/admin/frota/historico-abastecimento",
    label: "Historico de abastecimento",
    icon: "⛽",
    accent: "from-amber-400/25 to-orange-300/5",
    section: "Frota",
  },
  {
    path: "/admin/frota/localizacao-tempo-real",
    label: "Localizacao tempo real",
    icon: "📍",
    accent: "from-cyan-300/25 to-blue-400/5",
    section: "Frota",
  },
  { path: "/admin/frota/camera-ao-vivo", label: "Camera ao vivo", icon: "🎥", accent: "from-red-400/25 to-rose-300/5", section: "Frota" },
  { path: "/admin/financeiro", label: "Financeiro", icon: "💰", accent: "from-lime-400/25 to-amber-300/5", section: "Financeiro" },
];

const groupedMenuItems = menuItems.reduce((acc, item) => {
  const list = acc.get(item.section) || [];
  list.push(item);
  acc.set(item.section, list);
  return acc;
}, new Map<string, MenuItem[]>());

export default function AdminWorkspaceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const activePath = pathname || "/admin/painel";
  const [expanded, setExpanded] = useState(false);

  const logout = () => {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_TIMESTAMP_KEY);
    router.replace("/admin");
  };

  return (
    <AdminAuthGuard>
      <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-6 text-white md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#0ea5e9_0,#0f172a_45%,#020617_100%)]" />

        <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 lg:pr-40">
          <header className="rounded-3xl border border-cyan-200/20 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Painel ADM</p>
                <h1 className="mt-2 text-3xl font-bold">Administracao central</h1>
                <p className="mt-2 text-sm text-slate-300">Cada opcao em rota dedicada com identidade visual moderna.</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-xl border border-cyan-300/40 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-900 sm:w-auto"
              >
                Sair
              </button>
            </div>
          </header>

          <section className="rounded-3xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-2xl backdrop-blur md:p-6">
            {children}
          </section>
        </section>

        <aside className="fixed right-4 z-30 flex items-center justify-center bottom-6 top-auto -translate-y-0 lg:right-4 lg:top-1/2 lg:translate-y-0 lg:-translate-y-1/2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="relative z-30 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/40 bg-slate-900/90 text-2xl text-white shadow-xl transition hover:scale-105"
            title={expanded ? "Recolher menu" : "Abrir menu"}
          >
            {expanded ? "◀" : "▶"}
          </button>

          <nav
            className={`${expanded ? "pointer-events-auto" : "pointer-events-none"} absolute right-2 lg:right-16 bottom-full mb-2 lg:top-1/2 lg:bottom-auto lg:mb-0 z-20 w-[min(92vw,30rem)] max-w-[min(92vw,30rem)] min-w-0 transform-gpu rounded-[2rem] border border-white/10 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-sm transition-all duration-300 md:min-w-[22rem] md:max-w-[24rem] md:w-auto ${
              expanded ? "lg:-translate-y-1/2 lg:translate-x-0 translate-y-0 opacity-100" : "lg:-translate-y-1/2 lg:translate-x-12 opacity-0"
            }`}
            aria-label="Navegacao administrador"
          >
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] rotate-12 border border-cyan-200/20 bg-slate-900/30" />
            <div className="rotate-0 transform md:-rotate-12">
              <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:items-center">
                {Array.from(groupedMenuItems.entries()).map(([section, routes], sectionIndex) => (
                  <div key={section} className="flex md:flex-nowrap">
                    <div className="w-px bg-white/10" />
                    <div className="grid grid-cols-2 gap-2 px-2 md:flex md:flex-col">
                      {routes.map((route) => (
                        <Link
                          key={`${section}-${route.path}`}
                          href={route.path}
                          onClick={() => setExpanded(false)}
                          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-800/70 text-xl text-white transition hover:scale-105"
                          title={route.label}
                        >
                          <span
                            className={`pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br ${route.accent} opacity-0 transition group-hover:opacity-100`}
                          />
                          <span className="relative">{route.icon}</span>
                          <span className="pointer-events-none absolute left-0 top-1/2 z-10 -translate-x-full -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
                            <span className="mr-2 whitespace-nowrap rounded-lg border border-slate-500/30 bg-slate-900/95 px-2 py-1 text-xs font-semibold text-cyan-100">
                              {route.label}
                            </span>
                          </span>
                          {activePath === route.path ? <span className="absolute inset-0 rounded-2xl border-2 border-cyan-300/70" /> : null}
                        </Link>
                      ))}
                    </div>
                    {sectionIndex < Array.from(groupedMenuItems.keys()).length - 1 ? <div className="mx-2 h-8 w-px bg-white/20" /> : null}
                  </div>
                ))}
              </div>
            </div>
          </nav>
        </aside>
      </main>
    </AdminAuthGuard>
  );
}
