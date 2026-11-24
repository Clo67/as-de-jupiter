import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Compass, MessageSquare, Sparkles, RefreshCw, AlertCircle, Plus } from 'lucide-react';
import { TarotTema, MensajeChat, CartaNuevaChat, ChatConsultaResponse } from '../types/tarot';
import { TarotCardVisual } from './TarotCardVisual';
import { obtenerCartaPorNumero } from '../data/cartas';
import { postTarotApi, TarotApiError, LUNA_FRIENDLY_ERROR } from '../services/tarotApi';

interface LunaChatProps {
  tema: TarotTema;
  preguntaInicial?: string;
  cartasPrevias: Array<{ numero: number; nombre: string; posicion?: string }>;
  onClearSession?: () => void;
}

export const LunaChat: React.FC<LunaChatProps> = ({
  tema,
  preguntaInicial = '',
  cartasPrevias,
  onClearSession,
}) => {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    {
      id: 'init-1',
      role: 'model',
      text:
        cartasPrevias.length > 0
          ? `Saludos. Las cartas ya extendidas (${cartasPrevias.map((c) => c.nombre).join(', ')}) nos brindan un mapa simbólico claro. ¿Qué aspecto o matiz de esta lectura deseas que exploremos juntos?`
          : `Saludos. Estoy aquí para acompañarte en tus preguntas sobre el Tarot de Marsella y el ámbito de ${tema}. ¿Qué inquietud traes hoy a este espacio?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputTexto, setInputTexto] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [sessionCartas, setSessionCartas] = useState(cartasPrevias);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes, isLoading]);

  const sendQuestion = async (userQuestion: string, appendUserMessage: boolean) => {
    if (!userQuestion.trim() || isLoading) return;

    setError(null);
    setLastFailedQuestion(null);

    const historial = mensajes.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    if (appendUserMessage) {
      const userMessage: MensajeChat = {
        id: `usr-${Date.now()}`,
        role: 'user',
        text: userQuestion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMensajes((prev) => [...prev, userMessage]);
    }

    setIsLoading(true);

    try {
      const data = await postTarotApi<{
        success: boolean;
        data: ChatConsultaResponse;
      }>('/api/tarot/chat', {
        tema,
        preguntaInicial,
        cartasPrevias: sessionCartas,
        historialChat: historial,
        nuevaPregunta: userQuestion,
      });

      const modelReply = data.data.respuesta;
      const cartasNuevas: CartaNuevaChat[] = data.data.cartas_nuevas || [];

      if (cartasNuevas.length > 0) {
        setSessionCartas((prev) => [
          ...prev,
          ...cartasNuevas.map((c) => ({
            numero: c.numero,
            nombre: c.nombre,
            posicion: c.motivo || 'Carta complementaria',
          })),
        ]);
      }

      const modelMessage: MensajeChat = {
        id: `mod-${Date.now()}`,
        role: 'model',
        text: modelReply,
        cartasNuevas,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMensajes((prev) => [...prev, modelMessage]);
    } catch (err: unknown) {
      if (err instanceof TarotApiError) {
        setError(err.message);
      } else {
        setError(LUNA_FRIENDLY_ERROR);
      }
      setLastFailedQuestion(userQuestion);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTexto.trim() || isLoading) return;
    const userQuestion = inputTexto.trim();
    setInputTexto('');
    await sendQuestion(userQuestion, true);
  };

  const handleRetry = async () => {
    if (!lastFailedQuestion || isLoading) return;
    await sendQuestion(lastFailedQuestion, false);
  };

  return (
    <div id="luna-chat-section" className="w-full max-w-4xl mx-auto space-y-4">
      {/* Session Header */}
      <div className="bg-[#151025]/90 border border-[#D4AF37]/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="font-cinzel text-xs uppercase tracking-[0.2em] text-[#D4AF37] font-bold">
              Chat de Consulta con Luna
            </span>
            <span className="text-[10px] font-bold text-black bg-[#D4AF37] px-2.5 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">
              Tema: {tema}
            </span>
          </div>
          {preguntaInicial && (
            <p className="text-xs text-[#E0D8C8]/70 mt-1.5 italic line-clamp-1 font-serif">
              Consulta previa: "{preguntaInicial}"
            </p>
          )}
        </div>

        {onClearSession && (
          <button
            onClick={onClearSession}
            className="text-xs text-[#E0D8C8]/60 hover:text-[#D4AF37] flex items-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider font-mono text-[11px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reiniciar Sesión</span>
          </button>
        )}
      </div>

      {/* Cards in Session Context */}
      {sessionCartas.length > 0 && (
        <div className="bg-[#151025]/80 border border-[#D4AF37]/20 rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-cinzel text-[#D4AF37] uppercase tracking-[0.15em] block mb-3 px-1 font-bold">
            Arcanos en la mesa ({sessionCartas.length})
          </span>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {sessionCartas.map((c, i) => {
              const detalle = obtenerCartaPorNumero(c.numero);
              return (
                <div key={i} className="flex-shrink-0 flex flex-col items-center">
                  <TarotCardVisual
                    numero={c.numero}
                    nombre={c.nombre}
                    posicion={c.posicion}
                    detalle={detalle}
                    size="sm"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="bg-[#151025]/80 border border-[#D4AF37]/20 rounded-2xl p-4 sm:p-6 min-h-[380px] max-h-[500px] overflow-y-auto space-y-4 shadow-xl">
        {mensajes.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[11px] font-cinzel text-[#D4AF37] font-semibold tracking-wider">
                  {isUser ? 'Tú' : 'Luna'}
                </span>
                <span className="text-[10px] text-[#E0D8C8]/40 font-mono">{m.timestamp}</span>
              </div>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm sm:text-base leading-relaxed whitespace-pre-line font-serif ${
                  isUser
                    ? 'bg-[#2A2050] border border-[#D4AF37]/40 text-[#E0D8C8] rounded-tr-sm shadow-md'
                    : 'bg-black/40 border border-[#D4AF37]/25 text-white/95 rounded-tl-sm shadow-lg italic'
                }`}
              >
                {m.text}

                {/* If Luna brought a new card in this specific reply */}
                {m.cartasNuevas && m.cartasNuevas.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#D4AF37]/20 space-y-3 not-italic">
                    <span className="text-xs font-cinzel text-[#D4AF37] flex items-center gap-1.5 font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Carta complementaria manifestada por Luna:</span>
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {m.cartasNuevas.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[#1A1435] p-3 rounded-xl border border-[#D4AF37]/40 shadow-md">
                          <TarotCardVisual
                            numero={c.numero}
                            nombre={c.nombre}
                            detalle={obtenerCartaPorNumero(c.numero)}
                            size="sm"
                          />
                          {c.motivo && (
                            <p className="text-xs text-[#E0D8C8]/90 italic max-w-xs font-serif">
                              "{c.motivo}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2.5 text-[#D4AF37] text-xs py-2 px-1 font-cinzel">
            <Compass className="w-4 h-4 animate-spin text-[#D4AF37]" />
            <span>Luna está reflexionando en silencio con los arcanos...</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {lastFailedQuestion && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isLoading}
                className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/50 text-[#F3E5AB] text-[11px] font-cinzel font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reintentar</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSendMessage}
        className="flex items-center gap-2 bg-[#151025]/90 border border-[#D4AF37]/30 rounded-2xl p-2.5 shadow-xl"
      >
        <input
          id="luna-chat-input"
          type="text"
          value={inputTexto}
          onChange={(e) => setInputTexto(e.target.value)}
          placeholder="Escribe tu consulta de seguimiento a Luna..."
          disabled={isLoading}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-[#E0D8C8] placeholder-[#E0D8C8]/30 focus:outline-none font-serif"
        />
        <button
          id="send-chat-btn"
          type="submit"
          disabled={isLoading || !inputTexto.trim()}
          className="p-3 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
