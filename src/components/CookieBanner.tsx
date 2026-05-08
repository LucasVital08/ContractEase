import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('contractease_cookie_consent');
    if (!consent) {
      // Small delay so it doesn't pop instantly on load
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('contractease_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('contractease_cookie_consent', 'declined');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 bg-neutral-900 border border-white/10 p-5 rounded-2xl shadow-2xl z-50 flex flex-col gap-4"
        >
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <iconify-icon icon="solar:cookie-bold" class="text-2xl text-emerald-500" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-1">Privacidade & Cookies (LGPD)</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Utilizamos cookies e tecnologias similares para melhorar sua experiência. Ao continuar navegando, você concorda com a nossa{' '}
                <Link to="/privacy" className="text-emerald-400 hover:underline">
                  Política de Privacidade
                </Link>.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDecline}
              className="flex-1 py-2 rounded-xl text-xs font-bold text-neutral-400 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Recusar
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 py-2 rounded-xl text-xs font-bold text-black bg-emerald-500 hover:bg-emerald-400 transition-colors"
            >
              Aceitar Cookies
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
