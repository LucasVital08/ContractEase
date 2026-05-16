import { motion } from 'motion/react';

interface Props {
  onSelect: (mode: 'blank' | 'upload' | 'template') => void;
  onCancel: () => void;
}

export default function ModeSelectionModal({ onSelect, onCancel }: Props) {
  const modes = [
    {
      id: 'blank' as const,
      title: 'Documento em Branco',
      description: 'Comece do zero com um formulário inteligente',
      icon: 'solar:document-bold-duotone',
      color: 'from-emerald-500 to-emerald-600',
      features: ['Preenchimento inteligente com IA', 'Validação automática', 'Salvamento em tempo real'],
    },
    {
      id: 'upload' as const,
      title: 'Fazer Upload',
      description: 'Digitalize ou envie um documento existente',
      icon: 'solar:upload-minimalistic-bold-duotone',
      color: 'from-blue-500 to-blue-600',
      features: ['Reconhecimento óptico (OCR)', 'Processamento automático', 'Extração de dados'],
    },
    {
      id: 'template' as const,
      title: 'Usar Template',
      description: 'Escolha entre templates prontos para uso',
      icon: 'solar:copy-bold-duotone',
      color: 'from-purple-500 to-purple-600',
      features: ['Templates profissionais', 'Personalizável', 'Mantém histórico'],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl"
      >
        <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2 font-bricolage">Novo Documento</h2>
            <p className="text-neutral-400">Escolha como você quer começar</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {modes.map((mode) => (
              <motion.button
                key={mode.id}
                onClick={() => onSelect(mode.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-left"
              >
                <div className="border border-white/10 rounded-2xl p-6 h-full hover:border-white/20 bg-neutral-800/50 hover:bg-neutral-800 transition-all group">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <iconify-icon icon={mode.icon} class="text-white text-2xl" />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white mb-1">{mode.title}</h3>
                  <p className="text-sm text-neutral-400 mb-4">{mode.description}</p>

                  {/* Features */}
                  <div className="space-y-2">
                    {mode.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-neutral-500">
                        <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="mt-6 pt-4 border-t border-white/5">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      Escolher <iconify-icon icon="solar:arrow-right-bold" />
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-3 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
