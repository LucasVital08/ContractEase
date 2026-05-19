import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  initialContent?: string;
  onSave?: (content: string, tags: string[], privacy: string) => Promise<void>;
  mode: 'blank' | 'upload' | 'template';
}

export default function AdvancedDocumentEditor({ initialContent = '', onSave, mode }: Props) {
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [privacy, setPrivacy] = useState('private');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setContent(text);
      };
      reader.readAsText(file);
    }
  };

  const startVoiceInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (event) => {
        const blob = new Blob([event.data], { type: 'audio/webm' });
        // Here you would send to speech-to-text API
        console.log('Audio recorded:', blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  };

  const stopVoiceInput = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleMagicFill = () => {
    // Simulate AI magic fill
    const suggestions = [
      'Adicione uma cláusula de confidencialidade...',
      'Defina prazos de entrega...',
      'Especifique os termos de pagamento...',
    ];
    const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    setContent(content + '\n\n' + suggestion);
  };

  const handleAIGenerate = (type: string) => {
    // Simulate AI generation
    const templates: Record<string, string> = {
      summary: '## Resumo\n\nEste contrato estabelece os termos e condições...',
      risks: '## Análise de Riscos\n\n- Risco 1: ...\n- Risco 2: ...',
      simplify: '## Versão Simplificada\n\nOs pontos principais são...',
    };
    setContent(content + '\n\n' + (templates[type] || ''));
    setShowAIMenu(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="sticky top-16 z-10 bg-neutral-900 border border-white/5 rounded-xl p-4 flex flex-wrap items-center gap-3">
        {/* AI Menu */}
        <div className="relative">
          <button
            onClick={() => setShowAIMenu(!showAIMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors text-sm font-medium border border-fuchsia-500/20"
          >
            <iconify-icon icon="solar:magic-stick-3-bold" />
            IA
          </button>
          <AnimatePresence>
            {showAIMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 bg-neutral-800 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden w-48"
              >
                <button
                  onClick={() => handleAIGenerate('summary')}
                  className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 flex items-center gap-2"
                >
                  <iconify-icon icon="solar:document-bold" />
                  Gerar Resumo
                </button>
                <button
                  onClick={() => handleAIGenerate('risks')}
                  className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 flex items-center gap-2"
                >
                  <iconify-icon icon="solar:shield-warning-bold" />
                  Análise de Riscos
                </button>
                <button
                  onClick={() => handleAIGenerate('simplify')}
                  className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 flex items-center gap-2"
                >
                  <iconify-icon icon="solar:lightbulb-bold" />
                  Simplificar
                </button>
                <button
                  onClick={handleMagicFill}
                  className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 flex items-center gap-2 border-t border-white/5"
                >
                  <iconify-icon icon="solar:wand-2-bold" />
                  Magic Fill
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Voice Input */}
        <button
          onClick={() => setShowVoiceInput(!showVoiceInput)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium border border-blue-500/20"
        >
          <iconify-icon icon="solar:microphone-bold" />
          Voz
        </button>

        {/* Drag & Drop Hint */}
        {mode === 'upload' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm font-medium border border-emerald-500/20"
          >
            <iconify-icon icon="solar:upload-minimalistic-bold" />
            Upload
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".txt,.doc,.docx,.pdf"
          onChange={handleFileUpload}
        />

        {/* Autosave Status */}
        {isAutoSaving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-xs text-neutral-500"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-3 h-3"
            >
              <iconify-icon icon="solar:refresh-bold" />
            </motion.div>
            Salvando...
          </motion.div>
        )}

        <div className="flex-1" />

        {/* Privacy Selector */}
        <select
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value)}
          className="px-3 py-2 rounded-lg bg-neutral-800 border border-white/10 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
        >
          <option value="private">🔒 Privado</option>
          <option value="internal">👥 Interno</option>
          <option value="public">🌍 Público</option>
        </select>
      </div>

      {/* Voice Input Panel */}
      <AnimatePresence>
        {showVoiceInput && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3"
          >
            <button
              onClick={isRecording ? stopVoiceInput : startVoiceInput}
              className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${
                isRecording
                  ? 'bg-red-500 text-white'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isRecording && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-3 h-3 bg-white rounded-full"
                />
              )}
              {isRecording ? 'Parar Gravação' : 'Iniciar Gravação'}
            </button>
            <p className="text-sm text-blue-300">
              {isRecording ? 'Gravando... fale agora' : 'Clique para gravar sua voz'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor */}
      <div className="bg-neutral-900 border border-white/5 rounded-xl overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setIsAutoSaving(true);
            setTimeout(() => setIsAutoSaving(false), 1000);
          }}
          placeholder="Comece digitando ou importe um documento..."
          className="w-full h-96 bg-neutral-900 text-white p-6 resize-none focus:outline-none text-sm leading-relaxed"
        />
      </div>

      {/* Tags Section */}
      <div className="bg-neutral-900 border border-white/5 rounded-xl p-4">
        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Tags</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <motion.button
              key={tag}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => handleRemoveTag(tag)}
              className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
            >
              {tag}
              <iconify-icon icon="solar:close-circle-bold" class="text-sm" />
            </motion.button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Adicione uma tag..."
            className="flex-1 px-3 py-2 bg-neutral-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleAddTag}
            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors font-medium text-sm"
          >
            +
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={() => onSave?.(content, tags, privacy)}
        className="w-full px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
      >
        <iconify-icon icon="solar:check-circle-bold" />
        Salvar Documento
      </button>
    </div>
  );
}
