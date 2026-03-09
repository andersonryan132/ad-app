const feeds = [
  { id: 1, placa: "ABC-1234", localizacao: "BR-101 KM 214 - Zona Norte", atualizacao: "agora h 20s", bateria: 82 },
  { id: 2, placa: "DEF-5678", localizacao: "Rodovia BR-381, trecho industrial", atualizacao: "agora h 45s", bateria: 45 },
];

export default function AdminLocalizacaoTempoRealPage() {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-cyan-100">Localizacao em tempo real</h2>
      <p className="text-sm text-slate-300">Tela de monitoramento em tempo real por rota simulada.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {feeds.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
            <p className="font-semibold">{item.placa}</p>
            <p className="text-sm text-slate-300">Localizacao: {item.localizacao}</p>
            <p className="text-sm text-slate-400">
              Atualizado {item.atualizacao} • Bateria {item.bateria}%
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
