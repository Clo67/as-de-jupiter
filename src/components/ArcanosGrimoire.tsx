import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Sparkles, BookOpen, X, Heart, Coins, Users } from 'lucide-react';
import { TODAS_LAS_CARTAS, NUMEROS_ROMANOS } from '../data/cartas';
import { CartaConocimiento, TarotTema } from '../types/tarot';
import { TarotCardVisual } from './TarotCardVisual';

export const ArcanosGrimoire: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTheme, setActiveTheme] = useState<TarotTema | 'todos'>('todos');
  const [selectedCarta, setSelectedCarta] = useState<CartaConocimiento | null>(null);

  const filteredCartas = TODAS_LAS_CARTAS.filter((c) => {
    const matchesSearch =
      c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.palabras_clave.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.significado_general.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  return (
    <div id="grimoire-section" className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#151025]/95 via-[#1A1435]/95 to-[#151025]/95 border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-7 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.1)_0%,_transparent_70%)] rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold uppercase tracking-tighter mb-3 shadow-md">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Grimorio & Base de Conocimiento</span>
          </div>
          <h2 className="font-cinzel text-xl sm:text-2xl font-light text-[#D4AF37] tracking-[0.1em]">
            Los 22 Arcanos Mayores del Tarot de Marsella
          </h2>
          <p className="text-[#E0D8C8]/70 text-sm mt-1 max-w-2xl font-serif leading-relaxed">
            La sabiduría de los 22 arquetipos que Luna utiliza exclusivamente para realizar lecturas simbólicas, reflexivas y prácticas.
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px] z-10">
          <Search className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="search-arcanos-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o palabra clave..."
            className="w-full bg-black/40 border border-[#D4AF37]/30 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-[#E0D8C8] placeholder-[#E0D8C8]/30 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] font-serif"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {filteredCartas.map((carta) => (
          <div
            key={carta.numero}
            onClick={() => setSelectedCarta(carta)}
            className="bg-[#151025]/70 hover:bg-[#1A1435] border border-[#D4AF37]/20 hover:border-[#D4AF37] rounded-xl p-3 flex flex-col items-center text-center transition-all duration-300 cursor-pointer group hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(212,175,55,0.2)]"
          >
            <TarotCardVisual
              numero={carta.numero}
              nombre={carta.nombre}
              detalle={carta}
              lazy={true}
              size="sm"
            />
            <span className="font-cinzel text-[11px] sm:text-xs font-bold text-[#E0D8C8] mt-2.5 leading-snug min-h-[2.25rem] flex items-center justify-center text-center break-words group-hover:text-[#D4AF37] transition-colors px-0.5">
              {NUMEROS_ROMANOS[carta.numero]}. {carta.nombre}
            </span>
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              {carta.palabras_clave.slice(0, 2).map((kw, i) => (
                <span
                  key={i}
                  className="text-[9px] text-[#E0D8C8]/60 bg-black/50 px-1.5 py-0.5 rounded border border-[#D4AF37]/20"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Card Detail Modal */}
      <AnimatePresence>
        {selectedCarta && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-gradient-to-b from-[#1A1435] to-[#151025] border-2 border-[#D4AF37]/60 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 relative shadow-[0_0_50px_rgba(212,175,55,0.25)] space-y-5"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedCarta(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-[#E0D8C8]/70 hover:text-[#D4AF37] border border-[#D4AF37]/30 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-[#D4AF37]/20 pb-5">
                <TarotCardVisual
                  numero={selectedCarta.numero}
                  nombre={selectedCarta.nombre}
                  detalle={selectedCarta}
                  size="md"
                />
                <div className="space-y-2 text-center sm:text-left">
                  <span className="font-cinzel text-xs text-[#D4AF37] tracking-[0.2em] uppercase font-bold">
                    Arcano Mayor {NUMEROS_ROMANOS[selectedCarta.numero]}
                  </span>
                  <h3 className="font-cinzel text-2xl font-light text-[#E0D8C8]">
                    {selectedCarta.nombre}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                    {selectedCarta.palabras_clave.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs bg-[#2A2050] text-[#D4AF37] border border-[#D4AF37]/30 px-2.5 py-0.5 rounded-full"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-[#E0D8C8]/80 italic pt-1 font-serif">
                    "{selectedCarta.significado_general}"
                  </p>
                </div>
              </div>

              {/* Core Aspects */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-[#151025]/90 border border-emerald-500/30 rounded-xl space-y-1">
                  <span className="text-xs font-cinzel text-emerald-300 font-bold uppercase tracking-wider block">
                    Aspecto Positivo
                  </span>
                  <p className="text-xs text-[#E0D8C8]/80 leading-relaxed font-serif">
                    {selectedCarta.aspecto_positivo}
                  </p>
                </div>
                <div className="p-4 bg-[#151025]/90 border border-rose-500/30 rounded-xl space-y-1">
                  <span className="text-xs font-cinzel text-rose-300 font-bold uppercase tracking-wider block">
                    Aspecto Desafiante
                  </span>
                  <p className="text-xs text-[#E0D8C8]/80 leading-relaxed font-serif">
                    {selectedCarta.aspecto_desafiante}
                  </p>
                </div>
              </div>

              {/* Breakdown by Theme */}
              {selectedCarta.temas && (
                <div className="space-y-2">
                  <span className="font-cinzel text-xs uppercase tracking-[0.2em] text-[#D4AF37] font-bold block">
                    Desglose por Ámbito
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 bg-black/40 rounded-xl border border-[#D4AF37]/20">
                      <strong className="text-rose-300 block mb-1 flex items-center gap-1.5 font-cinzel">
                        <Heart className="w-3.5 h-3.5" /> Amor & Vínculos
                      </strong>
                      <p className="text-[#E0D8C8]/80 font-serif">{selectedCarta.temas.amor}</p>
                    </div>
                    <div className="p-3 bg-black/40 rounded-xl border border-[#D4AF37]/20">
                      <strong className="text-amber-300 block mb-1 flex items-center gap-1.5 font-cinzel">
                        <Coins className="w-3.5 h-3.5" /> Dinero & Proyectos
                      </strong>
                      <p className="text-[#E0D8C8]/80 font-serif">{selectedCarta.temas.dinero}</p>
                    </div>
                    <div className="p-3 bg-black/40 rounded-xl border border-[#D4AF37]/20">
                      <strong className="text-purple-300 block mb-1 flex items-center gap-1.5 font-cinzel">
                        <Sparkles className="w-3.5 h-3.5" /> Futuro & Destino
                      </strong>
                      <p className="text-[#E0D8C8]/80 font-serif">{selectedCarta.temas.futuro}</p>
                    </div>
                    <div className="p-3 bg-black/40 rounded-xl border border-[#D4AF37]/20">
                      <strong className="text-emerald-300 block mb-1 flex items-center gap-1.5 font-cinzel">
                        <Users className="w-3.5 h-3.5" /> Familia & Hogar
                      </strong>
                      <p className="text-[#E0D8C8]/80 font-serif">{selectedCarta.temas.familia}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Advice */}
              <div className="p-4 bg-gradient-to-r from-[#2A2050] to-[#151025] border border-[#D4AF37]/40 rounded-xl shadow-lg">
                <span className="font-cinzel text-xs text-[#D4AF37] font-bold uppercase tracking-wider block mb-1">
                  Consejo Clave del Arcano
                </span>
                <p className="text-xs sm:text-sm text-[#E0D8C8] italic font-serif">
                  "{selectedCarta.consejo}"
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
