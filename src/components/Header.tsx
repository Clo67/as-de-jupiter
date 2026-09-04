import React from 'react';
import { Sparkles, Layers, MessageSquare, BookOpen, Moon, Code2 } from 'lucide-react';
import { TipoTirada } from '../types/tarot';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: TipoTirada | 'grimoire';
  onSelectTab: (tab: TipoTirada | 'grimoire') => void;
  onOpenConfigModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenConfigModal,
}) => {
  return (
    <header className="w-full border-b border-[#D4AF37]/30 bg-[#0A0712]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Brand with Artistic Flair Circular Crest */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 border border-[#D4AF37] rounded-full flex items-center justify-center bg-[#151025] shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            <div className="w-5 h-5 bg-gradient-to-tr from-[#1A1133] to-[#4B3B7E] rounded-full flex items-center justify-center text-[#D4AF37] text-xs font-serif">
              ☾
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-cinzel text-xl sm:text-2xl tracking-[0.2em] font-light text-[#D4AF37]">
                AS DE JÚPITER
              </h1>
              <span className="text-[10px] font-bold text-black bg-[#D4AF37] px-2.5 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">
                Luna IA
              </span>
            </div>
            <p className="text-[11px] text-[#E0D8C8]/60 font-serif tracking-wide">
              Tarot de Marsella • Lecturas Simbólicas & Reflexivas
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-[#151025]/80 p-1.5 rounded-xl border border-[#D4AF37]/20 text-xs shadow-inner">
          <button
            id="tab-free-card"
            onClick={() => onSelectTab('carta_gratis')}
            className={`px-3.5 py-2 rounded-lg font-cinzel font-semibold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'carta_gratis'
                ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-bold'
                : 'text-[#E0D8C8]/70 hover:text-[#D4AF37] hover:bg-[#1A1435]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Carta Gratis</span>
          </button>

          <button
            id="tab-three-cards"
            onClick={() => onSelectTab('tres_cartas')}
            className={`px-3.5 py-2 rounded-lg font-cinzel font-semibold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tres_cartas'
                ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-bold'
                : 'text-[#E0D8C8]/70 hover:text-[#D4AF37] hover:bg-[#1A1435]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3 Cartas</span>
          </button>

          <button
            id="tab-chat"
            onClick={() => onSelectTab('chat')}
            className={`px-3.5 py-2 rounded-lg font-cinzel font-semibold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-bold'
                : 'text-[#E0D8C8]/70 hover:text-[#D4AF37] hover:bg-[#1A1435]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Luna</span>
          </button>

          <button
            id="tab-grimoire"
            onClick={() => onSelectTab('grimoire')}
            className={`px-3.5 py-2 rounded-lg font-cinzel font-semibold tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'grimoire'
                ? 'bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-bold'
                : 'text-[#E0D8C8]/70 hover:text-[#D4AF37] hover:bg-[#1A1435]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>22 Arcanos</span>
          </button>
        </div>

        {/* Action / Inspect Config & PWA Install */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />
          <button
            onClick={onOpenConfigModal}
            className="hidden sm:flex text-xs text-[#D4AF37] font-bold hover:bg-[#D4AF37]/20 bg-[#D4AF37]/10 border border-[#D4AF37]/40 px-3.5 py-2 rounded-xl items-center gap-1.5 transition-all cursor-pointer shadow-sm tracking-wider uppercase"
          >
            <Code2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Config: Luna</span>
          </button>
        </div>
      </div>
    </header>
  );
};
