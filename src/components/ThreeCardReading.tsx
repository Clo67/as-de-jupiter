import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, MessageSquare, RotateCcw, AlertCircle, Compass, Scroll, Layers } from 'lucide-react';
import { TarotTema, LecturaTresCartasResponse } from '../types/tarot';
import { ThemeSelector } from './ThemeSelector';
import { TarotCardVisual } from './TarotCardVisual';
import { postTarotApi, TarotApiError, LUNA_FRIENDLY_ERROR } from '../services/tarotApi';

interface ThreeCardReadingProps {
  onStartChatWithReading: (
    tema: TarotTema,
    pregunta: string,
    cartas: Array<{ numero: number; nombre: string; posicion?: string }>
  ) => void;
}

const ESQUEMAS_POSICIONES = [
  {
    id: 'situacion_obstaculo_consejo',
    label: 'Situación • Obstáculo • Consejo',
    posiciones: ['Situación actual', 'Obstáculo / Desafío', 'Consejo y rumbo'],
  },
  {
    id: 'pasado_presente_futuro',
    label: 'Pasado • Presente • Futuro',
    posiciones: ['Raíz o Pasado', 'Presente actual', 'Tendencia Futura'],
  },
  {
    id: 'mente_corazon_accion',
    label: 'Mente • Corazón • Acción',
    posiciones: ['Lo que piensas (Mente)', 'Lo que sientes (Corazón)', 'Hacia dónde actuar'],
  },
];

export const ThreeCardReading: React.FC<ThreeCardReadingProps> = ({
  onStartChatWithReading,
}) => {
  const [tema, setTema] = useState<TarotTema>('futuro');
  const [esquemaIndex, setEsquemaIndex] = useState(0);
  const [pregunta, setPregunta] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimitError, setIsRateLimitError] = useState(false);
  const [resultado, setResultado] = useState<LecturaTresCartasResponse | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);

  const executeThreeCardReading = async () => {
    setIsLoading(true);
    setError(null);
    setIsRateLimitError(false);
    setResultado(null);
    setActiveCardIndex(0);

    const posiciones = ESQUEMAS_POSICIONES[esquemaIndex].posiciones;

    try {
      const data = await postTarotApi<{
        success: boolean;
        data: LecturaTresCartasResponse;
      }>('/api/tarot/lectura-tres-cartas', {
        tema,
        pregunta: pregunta.trim() || undefined,
        posiciones,
      });

      setResultado(data.data);
    } catch (err: unknown) {
      if (err instanceof TarotApiError) {
        setError(err.message);
        setIsRateLimitError(err.isRateLimit);
      } else {
        setError(LUNA_FRIENDLY_ERROR);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeThreeCardReading();
  };

  const handleReset = () => {
    setResultado(null);
    setError(null);
    setIsRateLimitError(false);
  };

  return (
    <div id="three-cards-section" className="w-full max-w-5xl mx-auto space-y-6">
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-[#151025]/95 via-[#1A1435]/95 to-[#151025]/95 border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.1)_0%,_transparent_70%)] rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold uppercase tracking-tighter mb-3 shadow-md">
              <Layers className="w-3.5 h-3.5" />
              <span>Lectura de 3 Cartas • Tirada Completa</span>
            </div>
            <h2 className="font-cinzel text-xl sm:text-2xl font-light text-[#D4AF37] tracking-[0.1em]">
              Tirada Narrativa de 3 Posiciones con Luna
            </h2>
            <p className="text-[#E0D8C8]/70 text-sm mt-1.5 max-w-2xl font-serif leading-relaxed">
              Luna despliega tres Arcanos Mayores distintos, tejiendo una interpretación detallada para cada posición y un cierre integrador con consejo práctico.
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs text-[#D4AF37]/70 uppercase tracking-[0.2em] font-cinzel block">
              Sin Repeticiones
            </span>
            <span className="text-sm font-semibold text-[#D4AF37]">
              Cierre Narrativo Completo
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!resultado ? (
          <motion.form
            key="three-card-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="bg-[#151025]/80 border border-[#D4AF37]/20 rounded-2xl p-6 sm:p-8 backdrop-blur-md space-y-6 shadow-xl"
          >
            <ThemeSelector
              selectedTema={tema}
              onSelectTema={setTema}
              disabled={isLoading}
            />

            {/* Layout selector */}
            <div className="space-y-2">
              <label className="block font-cinzel text-xs uppercase tracking-[0.2em] text-[#D4AF37]">
                2. Esquema de Posiciones
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ESQUEMAS_POSICIONES.map((esq, idx) => (
                  <button
                    key={esq.id}
                    id={`layout-btn-${idx}`}
                    type="button"
                    disabled={isLoading}
                    onClick={() => setEsquemaIndex(idx)}
                    className={`p-3.5 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                      esquemaIndex === idx
                        ? 'bg-gradient-to-br from-[#2A2050] to-[#151025] border-[#D4AF37] text-[#E0D8C8] shadow-md ring-1 ring-[#D4AF37]/50'
                        : 'bg-black/30 border-[#D4AF37]/20 text-[#E0D8C8]/60 hover:bg-[#1A1435] hover:border-[#D4AF37]/40'
                    }`}
                  >
                    <span className="font-semibold block text-[#E0D8C8] mb-1 font-cinzel">
                      {esq.label}
                    </span>
                    <span className="text-[11px] text-[#E0D8C8]/60 block font-serif">
                      {esq.posiciones.join(' → ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Question Input */}
            <div className="space-y-2">
              <label
                htmlFor="three-card-question-input"
                className="block font-cinzel text-xs uppercase tracking-[0.2em] text-[#D4AF37]"
              >
                3. Pregunta o Asunto a Consultar
              </label>
              <textarea
                id="three-card-question-input"
                rows={3}
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                placeholder={`Describe el dilema o situación que quieres profundizar con Luna...`}
                disabled={isLoading}
                className="w-full bg-black/40 border border-[#D4AF37]/30 rounded-xl px-4 py-3 text-[#E0D8C8] placeholder-[#E0D8C8]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all resize-none font-serif"
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-300">Mensaje de Luna:</p>
                    <p className="text-xs text-red-200/90 mt-0.5">{error}</p>
                  </div>
                </div>
                {!isRateLimitError && (
                  <button
                    type="button"
                    onClick={executeThreeCardReading}
                    disabled={isLoading}
                    className="self-start sm:self-center px-3.5 py-2 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/50 text-[#F3E5AB] text-xs font-cinzel font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reintentar</span>
                  </button>
                )}
              </div>
            )}

            <button
              id="submit-three-cards-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-xl font-cinzel font-bold text-black bg-[#D4AF37] hover:bg-[#c49f2c] shadow-[0_0_25px_rgba(212,175,55,0.25)] transition-all duration-300 transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer tracking-wider"
            >
              {isLoading ? (
                <>
                  <Compass className="w-5 h-5 animate-spin text-black" />
                  <span>Luna está consagrando el espacio y sintiendo las 3 cartas...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-black" />
                  <span>Realizar Tirada Completa de 3 Cartas</span>
                </>
              )}
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="three-card-result"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Top Bar */}
            <div className="bg-[#151025]/90 border border-[#D4AF37]/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-ping" />
                <span className="font-cinzel text-xs uppercase tracking-[0.2em] text-[#D4AF37] font-semibold">
                  Tirada de 3 Arcanos Revelada
                </span>
                {pregunta && (
                  <span className="text-xs text-[#E0D8C8]/60 hidden md:inline truncate max-w-md font-serif italic">
                    • "{pregunta}"
                  </span>
                )}
              </div>
              <button
                id="reset-three-reading-btn"
                onClick={handleReset}
                className="text-xs text-[#E0D8C8]/60 hover:text-[#D4AF37] flex items-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nueva Tirada</span>
              </button>
            </div>

            {/* 3 Cards Row / Gallery in Artistic Flair */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-8 items-center justify-center py-2">
              {resultado.cartas.map((c, idx) => {
                const isSelected = activeCardIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveCardIndex(idx)}
                    className={`rounded-2xl p-4 flex flex-col items-center transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#D4AF37] bg-[#1A1435] shadow-[0_0_30px_rgba(212,175,55,0.25)] scale-105'
                        : 'border border-[#D4AF37]/30 bg-[#151025] opacity-75 hover:opacity-100 hover:border-[#D4AF37]/60'
                    }`}
                  >
                    <span className="font-cinzel text-xs uppercase tracking-[0.15em] text-[#D4AF37] font-bold mb-3 text-center">
                      Posición {idx + 1}: {c.posicion}
                    </span>
                    <TarotCardVisual
                      numero={c.numero}
                      nombre={c.nombre}
                      posicion={c.posicion}
                      detalle={(c as any).detalle}
                      size="md"
                    />
                    <div className="w-full mt-4 p-3 bg-black/40 rounded-xl border border-[#D4AF37]/20 text-left">
                      <p className="text-xs text-[#E0D8C8]/80 line-clamp-3 font-serif">
                        {c.interpretacion}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Card Deep Dive Panel */}
            {resultado.cartas[activeCardIndex] && (
              <div className="bg-[#1A1435]/90 border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-7 space-y-3 shadow-2xl relative">
                <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-cinzel text-xs text-[#D4AF37] font-semibold uppercase tracking-[0.15em]">
                      Interpretación de Posición {activeCardIndex + 1}
                    </span>
                    <span className="text-xs text-[#E0D8C8]/80 font-serif">
                      • {resultado.cartas[activeCardIndex].posicion} ({resultado.cartas[activeCardIndex].nombre})
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {resultado.cartas.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveCardIndex(i)}
                        className={`w-7 h-7 rounded-full text-xs font-bold font-cinzel transition-all cursor-pointer ${
                          activeCardIndex === i
                            ? 'bg-[#D4AF37] text-black shadow-md'
                            : 'bg-[#151025] border border-[#D4AF37]/30 text-[#E0D8C8]/60 hover:text-[#D4AF37]'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-white/95 text-base sm:text-lg leading-relaxed font-serif italic">
                  "{resultado.cartas[activeCardIndex].interpretacion}"
                </p>
              </div>
            )}

            {/* Cohesive Narrative Closure */}
            <div className="bg-gradient-to-br from-[#2A2050] via-[#1A1435] to-[#151025] border border-[#D4AF37]/40 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-4">
              <div className="flex items-center gap-2 text-[#D4AF37] font-cinzel font-bold text-sm tracking-widest uppercase">
                <Scroll className="w-4 h-4 text-[#D4AF37]" />
                <span>Cierre Narrativo & Consejo Práctico de Luna</span>
              </div>
              <p className="text-[#E0D8C8] text-base sm:text-lg leading-relaxed whitespace-pre-line font-serif">
                {resultado.cierre_narrativo}
              </p>

              <div className="pt-4 border-t border-[#D4AF37]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-[#E0D8C8]/60 font-serif">
                  ¿Quieres indagar en algún detalle de esta tirada con Luna?
                </p>
                <button
                  id="open-chat-from-three-btn"
                  onClick={() =>
                    onStartChatWithReading(
                      tema,
                      pregunta,
                      resultado.cartas.map((c) => ({
                        numero: c.numero,
                        nombre: c.nombre,
                        posicion: c.posicion,
                      }))
                    )
                  }
                  className="py-3 px-6 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] cursor-pointer tracking-wider"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Continuar en Chat con Luna</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
