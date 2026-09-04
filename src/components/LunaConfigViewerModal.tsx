import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Code2, Copy, Check, FileText } from 'lucide-react';
import {
  LUNA_SYSTEM_INSTRUCTION,
  LUNA_SCHEMA_CARTA_GRATIS,
  LUNA_SCHEMA_TRES_CARTAS,
  LUNA_SCHEMA_CHAT,
} from '../config/lunaConfig';

interface LunaConfigViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LunaConfigViewerModal: React.FC<LunaConfigViewerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gradient-to-b from-[#1A1435] to-[#151025] border-2 border-[#D4AF37]/60 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative shadow-[0_0_50px_rgba(212,175,55,0.25)] space-y-6"
        >
          <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-4">
            <div className="flex items-center gap-2.5">
              <Code2 className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <h3 className="font-cinzel text-lg font-bold text-[#E0D8C8]">
                  Configuración de Luna (`lunaConfig.ts`)
                </h3>
                <p className="text-xs text-[#E0D8C8]/60 font-serif">
                  Lógica de IA separada del código de interfaz, con prompts exactos y schemas JSON estructurados.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 text-[#E0D8C8]/70 hover:text-[#D4AF37] border border-[#D4AF37]/30 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: System Instruction */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-cinzel text-[#D4AF37] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                1. System Instruction de Luna (Inmutable)
              </span>
              <button
                onClick={() => handleCopy(LUNA_SYSTEM_INSTRUCTION, 'prompt')}
                className="text-xs text-[#E0D8C8]/60 hover:text-[#D4AF37] flex items-center gap-1 cursor-pointer font-mono"
              >
                {copiedSection === 'prompt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSection === 'prompt' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="p-4 bg-black/60 rounded-xl border border-[#D4AF37]/20 text-xs text-[#E0D8C8]/90 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {LUNA_SYSTEM_INSTRUCTION}
            </pre>
          </div>

          {/* Section 2: Schemas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-cinzel text-[#D4AF37] font-bold uppercase tracking-wider">
                  2. Schema Carta Gratis (1 Carta)
                </span>
              </div>
              <pre className="p-3 bg-black/60 rounded-xl border border-[#D4AF37]/20 text-[11px] text-[#F3E5AB] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                {JSON.stringify(LUNA_SCHEMA_CARTA_GRATIS, null, 2)}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-cinzel text-[#D4AF37] font-bold uppercase tracking-wider">
                  3. Schema 3 Cartas (Paga)
                </span>
              </div>
              <pre className="p-3 bg-black/60 rounded-xl border border-[#D4AF37]/20 text-[11px] text-[#D4AF37] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                {JSON.stringify(LUNA_SCHEMA_TRES_CARTAS, null, 2)}
              </pre>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
