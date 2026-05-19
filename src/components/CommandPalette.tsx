import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Icon } from '@iconify/react';

interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  action: () => void;
  shortcut?: string;
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    { id: 'new-contract', title: 'Novo Contrato', description: 'Criar um novo documento do zero', icon: 'solar:plus-bold', category: 'Ações Rápidas', action: () => navigate('/contracts/new'), shortcut: 'N' },
    { id: 'contracts', title: 'Ver Contratos', description: 'Lista de todos os seus documentos', icon: 'solar:file-text-bold', category: 'Navegação', action: () => navigate('/contracts') },
    { id: 'templates', title: 'Modelos / Templates', description: 'Biblioteca de documentos prontos', icon: 'solar:layout-bold', category: 'Navegação', action: () => navigate('/templates') },
    { id: 'finance', title: 'Financeiro & Créditos', description: 'Gerenciar saldo e assinatura', icon: 'ph:coins-bold', category: 'Sistema', action: () => navigate('/finance'), shortcut: 'F' },
    { id: 'settings', title: 'Configurações', description: 'Preferências da conta e organização', icon: 'solar:settings-bold', category: 'Sistema', action: () => navigate('/settings'), shortcut: ',' },
    { id: 'analytics', title: 'Analytics', description: 'Métricas e performance', icon: 'solar:chart-square-bold', category: 'Sistema', action: () => navigate('/analytics') },
  ];

  const filteredCommands = query === '' 
    ? commands 
    : commands.filter(c => 
        c.title.toLowerCase().includes(query.toLowerCase()) || 
        c.description.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
      );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (item: CommandItem) => {
    item.action();
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex]);
      }
    }
  };

  // Expose toggle to global event
  useEffect(() => {
    const handleOpenSearch = () => setIsOpen(true);
    window.addEventListener('open-global-search', handleOpenSearch);
    return () => window.removeEventListener('open-global-search', handleOpenSearch);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] cursor-default"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-2xl bg-neutral-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto ring-1 ring-white/5"
              onKeyDown={handleKeyDown}
            >
              {/* Search Input */}
              <div className="flex items-center px-4 py-4 border-b border-white/10 bg-black/20">
                <Icon icon="solar:magnifer-linear" className="text-xl text-neutral-500 mr-3" />
                <input 
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar por contratos, templates ou ações..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-neutral-500 text-lg font-medium"
                />
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10">
                  <span className="text-[10px] font-bold text-neutral-400">ESC</span>
                </div>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                {filteredCommands.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-neutral-500">Nenhum resultado encontrado para "{query}"</p>
                  </div>
                ) : (
                  <div className="space-y-4 py-2">
                    {/* Group by category */}
                    {Array.from(new Set(filteredCommands.map(c => c.category))).map(category => (
                      <div key={category}>
                        <h4 className="px-3 py-2 text-[10px] uppercase font-bold tracking-widest text-neutral-500">{category}</h4>
                        <div className="space-y-1">
                          {filteredCommands.filter(c => c.category === category).map((item) => {
                            const actualIndex = filteredCommands.indexOf(item);
                            const isSelected = selectedIndex === actualIndex;

                            return (
                              <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setSelectedIndex(actualIndex)}
                                className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all text-left ${
                                  isSelected ? 'bg-emerald-500/10 border border-emerald-500/20' : 'border border-transparent hover:bg-white/5'
                                }`}
                              >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-emerald-500 text-black' : 'bg-white/5 text-neutral-400'}`}>
                                  <Icon icon={item.icon} className="text-xl" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold ${isSelected ? 'text-white' : 'text-neutral-200'}`}>{item.title}</span>
                                    {item.shortcut && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-500 font-mono">
                                        {item.shortcut}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-neutral-500">{item.description}</p>
                                </div>
                                {isSelected && <Icon icon="solar:arrow-right-linear" className="text-lg text-emerald-500" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-white/5 bg-black/40 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-neutral-400 font-mono">↵</kbd>
                    <span className="text-[10px] text-neutral-500">Selecionar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-neutral-400 font-mono">↑↓</kbd>
                    <span className="text-[10px] text-neutral-500">Navegar</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:command-bold" className="text-sm text-neutral-500" />
                  <span className="text-[10px] text-neutral-500">Spotlight Search</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
