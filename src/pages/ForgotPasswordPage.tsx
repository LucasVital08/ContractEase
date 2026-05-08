import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '@/services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.auth.resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar instruções');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 relative">
      <div className="bg-grain" />
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-neutral-900 border border-white/5 rounded-2xl p-8 relative z-10 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-xl">
            CE
          </div>
        </div>
        
        <h1 className="text-2xl font-bold font-bricolage mb-2 text-center">Esqueci minha senha</h1>
        
        {!success ? (
          <>
            <p className="text-neutral-400 mb-8 text-center text-sm">Digite seu e-mail e enviaremos instruções para redefinir sua senha.</p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                <iconify-icon icon="solar:danger-triangle-bold" />
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                  placeholder="nome@empresa.com"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : 'Enviar instruções'}
              </button>
            </form>
          </>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
            <iconify-icon icon="solar:letter-opened-bold-duotone" class="text-6xl text-emerald-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Verifique seu e-mail</h3>
            <p className="text-neutral-400 text-sm mb-6">Enviamos as instruções para redefinição de senha para <span className="text-white">{email}</span></p>
          </motion.div>
        )}

        <div className="mt-8 text-center">
          <Link to="/login" className="text-sm text-neutral-400 hover:text-white flex items-center justify-center gap-2">
            <iconify-icon icon="solar:arrow-left-linear" /> Voltar para o Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
