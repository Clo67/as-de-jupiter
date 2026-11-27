import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, MessageSquare, ArrowRight, RotateCcw, AlertCircle, Quote, Compass, Eye } from 'lucide-react';
import { TarotTema, CartaGratisResponse, CartaConocimiento } from '../types/tarot';
import { ThemeSelector } from './ThemeSelector';
import { TarotCardVisual } from './TarotCardVisual';
import { ShuffleAnimation } from './ShuffleAnimation';
import { formatConsejoCartaTitulo } from '../data/cartas';
import { postTarotApi, TarotApiError, LUNA_FRIENDLY_ERROR } from '../services/tarotApi';

interface FreeCardReadingProps {
  onStartChatWithReading: (tema: TarotTema, pregunta: string, carta: { numero: number; nombre: string }) => void;
  onGoToThreeCards: () => void;
}

export const FreeCardReading: React.FC<FreeCardReadingProps> = ({
  onStartChatWithReading,
  onGoToThreeCards,
}) => {
  const [tema, setTema] = useState<TarotTema>('futuro');
  const [pregunta, setPregunta] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimitError, setIsRateLimitError] = useState(false);
  const [resultado, setResultado] = useState<CartaGratisResponse | null>(null);
  const [cartaDetalle, setCartaDetalle] = useState<CartaConocimiento | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [cardRevealed, setCardRevealed] = useState(false);

  useEffect(() => {
    if (!resultado) {
      setCardRevealed(false);
      return;
    }
    setCardRevealed(false);
    const timer = setTimeout(() => setCardRevealed(true), 140);
    return () => clearTimeout(timer);
  }, [resultado]);

  const executeFreeReading = async () => {
    setIsLoading(true);
    setError(null);
    setIsRateLimitError(false);
    setResultado(null);
    setCartaDetalle(null);
    setCardRevealed(false);

    try {
      const minShuffleDelay = new Promise((resolve) => setTimeout(resolve, 1500));
      const [data] = await Promise.all([
        postTarotApi<{
          success: boolean;
          data: CartaGratisResponse;
          cartaDetalle: CartaConocimiento | null;
        }>('/api/tarot/carta-gratis', {
          tema,
          pregunta: pregunta.trim() || undefined,
        }),
        minShuffleDelay,
      ]);

      setResultado(data.data);
      setCartaDetalle(data.cartaDetalle);
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
    await executeFreeReading();
  };

  const handleReset = () => {
    setResultado(null);
    setCartaDetalle(null);
    setError(null);
    setIsRateLimitError(false);
  };

  return (
    <div id="free-card-section" className="w-full max-w-4xl mx-auto space-y-6">
      {/* Intro banner */}
      <div className="bg-gradient-to-r from-[#151025]/95 via-[#1A1435]/95 to-[#151025]/95 border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.1)_0%,_transparent_70%)] rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37] text-black text-[10px] font-bold uppercase tracking-tighter mb-3 shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Carta Gratis • Lead Magnet</span>
            </div>
            <h2 className="font-cinzel text-xl sm:text-2xl font-light text-[#D4AF37] tracking-[0.1em]">
              Consulta de una Carta con Luna
            </h2>
            <p className="text-[#E0D8C8]/70 text-sm mt-1.5 max-w-xl font-serif leading-relaxed">
              Se mezclan los 22 Arcanos Mayores del Tarot de Marsella y sale una carta al azar. Luna la interpreta para tu pregunta en 3 a 4 líneas esenciales.
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs text-[#D4AF37]/70 uppercase tracking-[0.2em] font-cinzel block">
              Tarot de Marsella
            </span>
            <span className="text-sm font-semibold text-[#D4AF37]">
              22 Arcanos Mayores
            </span>
          </div>
        </div>
      </div>

      {/* Main consultation form or Result */}
      <AnimatePresence mode="wait">
        {!resultado ? (
          <motion.form
            key="form"
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

            <div className="space-y-2">
              <label
                htmlFor="user-question-input"
                className="block font-cinzel text-xs uppercase tracking-[0.2em] text-[#D4AF37]"
              >
                2. Tu Pregunta o Inquietud (Opcional pero recomendado)
              </label>
              <textarea
                id="user-question-input"
                rows={3}
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                placeholder={`Ej: ¿Qué energía necesito cultivar en mi ${tema === 'amor' ? 'relación' : tema === 'dinero' ? 'proyecto actual' : tema === 'familia' ? 'hogar' : 'camino próximo'}?`}
                disabled={isLoading}
                className="w-full bg-black/40 border border-[#D4AF37]/30 rounded-xl px-4 py-3 text-[#E0D8C8] placeholder-[#E0D8C8]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all resize-none font-serif"
              />
              <p className="text-xs text-[#E0D8C8]/50 flex items-center justify-between font-mono text-[11px]">
                <span>Las cartas se mezclan y se eligen al azar, como en una tirada real. Luna las interpreta a la luz de tu pregunta.</span>
                <span>{pregunta.length}/300</span>
              </p>
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
                {isRateLimitError ? (
                  <button
                    type="button"
                    onClick={onGoToThreeCards}
                    className="self-start sm:self-center px-3.5 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#c49f2c] text-black text-xs font-cinzel font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0 shadow-md"
                  >
                    <span>Tirada de 3 Cartas</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={executeFreeReading}
                    disabled={isLoading}
                    className="self-start sm:self-center px-3.5 py-2 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/50 text-[#F3E5AB] text-xs font-cinzel font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reintentar</span>
                  </button>
                )}
              </div>
            )}

            {isLoading && <ShuffleAnimation cantidad={1} />}

            <button
              id="submit-free-card-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-xl font-cinzel font-bold text-black bg-[#D4AF37] hover:bg-[#c49f2c] shadow-[0_0_25px_rgba(212,175,55,0.25)] transition-all duration-300 transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer tracking-wider"
            >
              {isLoading ? (
                <>
                  <Compass className="w-5 h-5 animate-spin text-black" />
                  <span>Mezclando las cartas al azar...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-black" />
                  <span>Revelar mi Carta Gratis con Luna</span>
                </>
              )}
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-[#1A1435]/80 border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-8 backdrop-blur-md space-y-6 shadow-2xl relative"
          >
            <div className="absolute -top-3 left-8 bg-[#D4AF37] text-black text-[10px] px-3 py-1 font-bold tracking-tighter rounded-full uppercase shadow-md">
              Lectura Revelada por Luna
            </div>

            {/* Top result info */}
            <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-4 pt-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-ping" />
                <span className="font-cinzel text-xs uppercase tracking-[0.2em] text-[#D4AF37]">
                  Arcano Sorteado
                </span>
              </div>
              <button
                id="reset-free-reading-btn"
                onClick={handleReset}
                className="text-xs text-[#E0D8C8]/60 hover:text-[#D4AF37] flex items-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nueva Consulta</span>
              </button>
            </div>

            {/* Visual card + Luna interpretation */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Card visual column */}
              <div className="md:col-span-4 flex flex-col items-center justify-center">
                <TarotCardVisual
                  numero={resultado.carta.numero}
                  nombre={resultado.carta.nombre}
                  detalle={cartaDetalle}
                  isRevealed={cardRevealed}
                  size="lg"
                />
              </div>

              {/* Interpretation column */}
              <div className="md:col-span-8 space-y-4">
                <div className="bg-black/40 border border-[#D4AF37]/25 rounded-2xl p-6 relative">
                  <Quote className="w-8 h-8 text-[#D4AF37]/20 absolute top-3 right-3 pointer-events-none" />
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs uppercase font-cinzel tracking-[0.15em] text-[#D4AF37]">
                      Voz de Luna • Tarotista de As de Júpiter
                    </span>
                  </div>
                  <p className="text-white/95 text-base sm:text-lg leading-relaxed whitespace-pre-line font-serif italic">
                    "{resultado.interpretacion_breve}"
                  </p>
                </div>

                {/* Educational clue: Para que lo reconozcas la próxima vez */}
                {resultado.simbolo_clave && (
                  <div className="bg-[#2A2050]/45 border border-[#D4AF37]/30 rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-cinzel text-[#D4AF37] uppercase tracking-wider font-semibold">
                      <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Para que lo reconozcas la próxima vez</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#E0D8C8]/90 font-serif leading-relaxed">
                      {resultado.simbolo_clave}
                    </p>
                  </div>
                )}

                {/* Card advice from Marseille knowledge base */}
                {cartaDetalle && (
                  <div className="bg-[#151025]/80 border border-[#D4AF37]/20 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-cinzel text-[#D4AF37] uppercase tracking-wider">
                        {formatConsejoCartaTitulo(cartaDetalle.nombre)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFullDetails(!showFullDetails)}
                        className="text-xs text-[#E0D8C8]/60 hover:text-[#D4AF37] underline cursor-pointer"
                      >
                        {showFullDetails ? 'Ocultar arcanos' : 'Ver simbolismo'}
                      </button>
                    </div>
                    <p className="text-xs text-[#E0D8C8]/80 italic font-serif">
                      "{cartaDetalle.consejo}"
                    </p>

                    {showFullDetails && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="pt-3 border-t border-[#D4AF37]/15 text-xs space-y-2 text-[#E0D8C8]/70"
                      >
                        <p><strong className="text-emerald-400">Aspecto positivo:</strong> {cartaDetalle.aspecto_positivo}</p>
                        <p><strong className="text-rose-400">Aspecto desafiante:</strong> {cartaDetalle.aspecto_desafiante}</p>
                        {cartaDetalle.temas && (
                          <p><strong className="text-[#D4AF37]">En el ámbito ({tema}):</strong> {cartaDetalle.temas[tema]}</p>
                        )}
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    id="chat-followup-btn"
                    onClick={() =>
                      onStartChatWithReading(tema, pregunta, resultado.carta)
                    }
                    className="flex-1 py-3.5 px-4 rounded-xl border border-[#D4AF37]/40 bg-[#151025] hover:bg-[#1A1435] text-[#E0D8C8] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm tracking-wide"
                  >
                    <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
                    <span>Preguntar a Luna sobre esta carta</span>
                  </button>

                  <button
                    id="upgrade-to-three-cards-btn"
                    onClick={onGoToThreeCards}
                    className="flex-1 py-3.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] cursor-pointer tracking-wide"
                  >
                    <span>Tirada Completa de 3 Cartas</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
