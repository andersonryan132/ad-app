const stockData = [
  { produto: "Diesel S10", atual: 3200, capacidade: 5000, cor: "bg-cyan-400" },
  { produto: "Oleo 15W40", atual: 1200, capacidade: 1800, cor: "bg-emerald-400" },
  { produto: "Filtrado", atual: 350, capacidade: 1200, cor: "bg-amber-400" },
];

const alerts = [
  { titulo: "Aviso de abastecimento", descricao: "1 veículo sem abastecimento confirmado nas ultimas 48h." },
  { titulo: "Estoque baixo", descricao: "Pecas em estoque abaixo de 40 un." },
  { titulo: "Manutencao", descricao: "1 veiculo em revisao preventiva para hoje." },
];

export default function AdminPainelPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-cyan-200/20 bg-gradient-to-r from-slate-900 to-slate-900/70 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Dashboard ADM</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Bem-vindo ao painel de gestao</h2>
        <p className="mt-2 text-sm text-slate-300">Acompanhe alertas e estoque. A proxima pagina ainda sera aberta pelo menu lateral.</p>
      </section>

      <section className="rounded-3xl border border-amber-200/20 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold text-amber-200">Alertas</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {alerts.map((alert) => (
            <article key={alert.titulo} className="rounded-2xl border border-amber-300/20 bg-slate-950/80 p-4">
              <p className="text-sm font-semibold text-amber-200">{alert.titulo}</p>
              <p className="mt-1 text-sm text-slate-300">{alert.descricao}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-200/20 bg-slate-900/70 p-6">
        <h3 className="text-lg font-semibold text-cyan-200">Grafico do stock</h3>
        <p className="mt-1 text-sm text-slate-300">Nivel atual de inventario comparado com capacidade.</p>

        <div className="mt-6 space-y-4">
          {stockData.map((item) => {
            const percent = Math.round((item.atual / item.capacidade) * 100);
            return (
              <div key={item.produto}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{item.produto}</span>
                  <span className="text-xs text-slate-400">{item.atual} / {item.capacidade}</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${item.cor}`} style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-400">{percent}% de ocupacao</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
