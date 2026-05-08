import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore } from '@/stores';
import { api } from '@/services/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.auth.register(name, email, password);
      if (response.token) {
        // Auto-login if email confirmation is disabled
        login(response.user, response.organization);
        navigate('/dashboard');
      } else {
        // Email confirmation required
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <div className="bg-grain" />
      
      {/* Left side - Visual */}
      <div className="hidden md:flex w-1/2 bg-neutral-900 border-r border-white/5 relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/10 to-transparent" />
        <div className="relative z-10 max-w-lg text-center">
          <iconify-icon icon="solar:users-group-two-rounded-bold-duotone" class="text-8xl text-violet-500 mb-8 drop-shadow-2xl" />
          <h2 className="text-4xl font-bold font-bricolage text-white mb-4">Junte-se à revolução jurídica.</h2>
          <p className="text-neutral-400 text-lg">Milhares de empresas já estão gerenciando seus contratos de forma inteligente e segura.</p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg">
              CE
            </div>
            <span className="font-bricolage font-bold text-2xl tracking-tight">ContractEase</span>
          </div>

          <h1 className="text-3xl font-bold font-bricolage mb-2">Crie sua conta</h1>
          <p className="text-neutral-400 mb-8">Comece agora mesmo. É rápido e gratuito.</p>

          {success ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
              <iconify-icon icon="solar:letter-opened-bold-duotone" class="text-7xl text-emerald-500 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Verifique seu e-mail!</h3>
              <p className="text-neutral-400 text-sm mb-6">
                Enviamos um link de confirmação para <span className="text-white font-medium">{email}</span>.
                <br />Clique nele para ativar sua conta.
              </p>
              <Link to="/login" className="text-emerald-500 hover:text-emerald-400 text-sm font-medium">
                Ir para Login →
              </Link>
            </motion.div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                  <iconify-icon icon="solar:danger-triangle-bold" />
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50"
                    placeholder="nome@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">Senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                
                <p className="text-xs text-neutral-500 mt-4">
                  Ao se registrar, você concorda com nossos <a href="#" className="text-violet-400 hover:underline">Termos de Serviço</a> e <a href="#" className="text-violet-400 hover:underline">Política de Privacidade</a>.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors mt-4 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : 'Criar conta gratuita'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-neutral-400 mt-8 text-sm">
            Já tem uma conta? <Link to="/login" className="text-white font-medium hover:underline">Entrar</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
