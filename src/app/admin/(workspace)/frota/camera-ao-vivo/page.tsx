export default function AdminCameraAoVivoPage() {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-cyan-100">Camera ao vivo</h2>
      <p className="text-sm text-slate-300">Tela dedicada para integracao com camera em tempo real.</p>
      <div className="aspect-video rounded-2xl border border-rose-300/20 bg-black/90 p-5">
        <p className="text-sm text-rose-100">
          Integracao de stream mockada. Aqui entrara o player de video do backend/servico externo.
        </p>
      </div>
    </div>
  );
}
