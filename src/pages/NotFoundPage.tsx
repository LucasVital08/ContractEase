import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <iconify-icon icon="solar:ghost-bold-duotone" class="text-8xl text-neutral-600 mb-6" />
      <h1 className="text-5xl font-bold font-bricolage text-white mb-3">404</h1>
      <p className="text-neutral-400 text-lg mb-8">Página não encontrada.</p>
      <Link
        to="/dashboard"
        className="px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-2"
      >
        <iconify-icon icon="solar:arrow-left-linear" />
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
