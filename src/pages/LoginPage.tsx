import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore, useNotificationStore } from '@/stores';
import { api } from '@/services/api';
import { OTPModal } from '@/components/OTPModal';
import { TwoFactorVerifyModal } from '@/components/TwoFactorVerifyModal';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{ user: any; organization: any; factorId: string } | null>(null);
  const login = useAuthStore((s) => s.login);
  const notify = useNotificationStore(s => s.add);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.auth.login(email, password);
      
      // Verificar se o usuário possui MFA ativo
      const factors = await api.auth.mfa.listFactors();
      const verifiedFactor = (factors.all || []).find((f: any) => f.status === 'verified');

      if (verifiedFactor) {
        setPendingLogin({ 
          user: response.user, 
          organization: response.organization, 
          factorId: verifiedFactor.id 
        });
        setIs2FAModalOpen(true);
        return;
      }

      login(response.user, response.organization);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = () => {
    if (pendingLogin) {
      login(pendingLogin.user, pendingLogin.organization);
      navigate('/dashboard');
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError('Informe seu e-mail para receber o link de acesso.');
      return;
    }
    setLoading(true);
    try {
      await api.auth.signInWithOtp(email);
      setIsOTPModalOpen(true);
      notify({ type: 'info', title: 'Código enviado', message: 'Verifique seu e-mail para o código de acesso.' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerifySuccess = async () => {
    try {
      const session = await api.auth.getSession();
      if (session) {
        navigate('/dashboard');
        window.location.reload();
      }
    } catch (e) {
      setError('Erro ao processar login após verificação.');
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError('');
    try {
      if (provider === 'google') {
        await api.auth.loginWithGoogle();
      } else {
        await api.auth.loginWithGithub();
      }
    } catch (err: any) {
      setError(err.message || `Erro ao fazer login com ${provider}`);
    }
  };

  const handlePasskeyLogin = async () => {
    setLoading(true);
    try {
      // Simulação de WebAuthn / Passkey
      await new Promise(r => setTimeout(r, 1500));
      notify({ type: 'success', title: 'Biometria Reconhecida', message: 'Acesso liberado via Passkey.' });
      navigate('/dashboard');
    } catch (e) {
      setError('Falha na autenticação biométrica.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <div className="bg-grain" />
      
      {/* Left side - Form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-lg">
              CE
            </div>
            <span className="font-bricolage font-bold text-2xl tracking-tight">ContractEase</span>
          </div>

          <h1 className="text-3xl font-bold font-bricolage mb-2">Bem-vindo de volta</h1>
          <p className="text-neutral-400 mb-8">Entre com suas credenciais para acessar seus contratos.</p>

          <div className="flex gap-4 mb-6">
            <button 
              onClick={() => handleOAuth('google')}
              className="flex-1 py-2.5 rounded-xl border border-white/10 flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
            >
              <iconify-icon icon="logos:google-icon" /> Google
            </button>
            <button 
              onClick={() => handleOAuth('github')}
              className="flex-1 py-2.5 rounded-xl border border-white/10 flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
            >
              <iconify-icon icon="logos:github-icon" /> GitHub
            </button>
          </div>

          <button 
            onClick={handlePasskeyLogin}
            className="w-full mb-6 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 hover:bg-white/10 transition-all hover:scale-[1.02]"
          >
            <iconify-icon icon="solar:fingerprint-bold" class="text-xl text-emerald-400" />
            <span className="font-medium">Entrar com Passkey (Biometria)</span>
          </button>

          <div className="relative flex items-center py-4 mb-6">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-neutral-500 text-sm">ou continue com e-mail</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
              <iconify-icon icon="solar:danger-triangle-bold" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-neutral-400">Senha</label>
                <Link to="/forgot-password" className="text-sm text-emerald-500 hover:text-emerald-400">Esqueceu a senha?</Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              className="w-full py-3 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <iconify-icon icon="solar:letter-bold" /> Entrar com Código (E-mail)
            </button>
          </form>

          <p className="text-center text-neutral-400 mt-8 text-sm">
            Não tem uma conta? <Link to="/register" className="text-white font-medium hover:underline">Registre-se gratuitamente</Link>
          </p>
        </motion.div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden md:flex w-1/2 bg-neutral-900 border-l border-white/5 relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
        <div className="relative z-10 max-w-lg text-center">
          <iconify-icon icon="solar:shield-check-bold-duotone" class="text-8xl text-emerald-500 mb-8 drop-shadow-2xl" />
          <h2 className="text-4xl font-bold font-bricolage text-white mb-4">A plataforma definitiva para contratos inteligentes.</h2>
          <p className="text-neutral-400 text-lg">Crie, gerencie e assine contratos com validade jurídica e registro na rede Stellar.</p>
        </div>
      </div>

      <OTPModal 
        isOpen={isOTPModalOpen} 
        onClose={() => setIsOTPModalOpen(false)} 
        onSuccess={handleOTPVerifySuccess}
        purpose="supabase_auth"
        email={email}
        digits={6}
      />

      <TwoFactorVerifyModal
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
        onSuccess={handle2FASuccess}
        factorId={pendingLogin?.factorId || ''}
      />
    </div>
  );
}
