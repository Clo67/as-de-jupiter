import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { FreeCardReading } from './components/FreeCardReading';
import { ThreeCardReading } from './components/ThreeCardReading';
import { LunaChat } from './components/LunaChat';
import { ArcanosGrimoire } from './components/ArcanosGrimoire';
import { OfflineIndicator } from './components/OfflineIndicator';
import { UnlockedSessionPayload } from './components/PaywallGate';
import { BuyerSessionState, TarotTema, TipoTirada } from './types/tarot';
import { getTarotApi, postTarotApi } from './services/tarotApi';
import { ShieldCheck } from 'lucide-react';

const INITIAL_SESSION: BuyerSessionState = {
  loading: true,
  unlocked: false,
  isTestBuyer: false,
  tiradasRestantesHoy: null,
  maxTiradasPorDia: 5,
  maxMensajesPorTirada: 10,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TipoTirada | 'grimoire'>('carta_gratis');
  const [session, setSession] = useState<BuyerSessionState>(INITIAL_SESSION);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  // Active reading context passed into Chat
  const [sessionTema, setSessionTema] = useState<TarotTema>('futuro');
  const [sessionPregunta, setSessionPregunta] = useState<string>('');
  const [sessionCartas, setSessionCartas] = useState<
    Array<{ numero: number; nombre: string; posicion?: string }>
  >([]);
  const [sessionTiradaId, setSessionTiradaId] = useState<string | undefined>(undefined);
  const [sessionMensajesRestantes, setSessionMensajesRestantes] = useState<number>(10);
  const [chatSessionKey, setChatSessionKey] = useState<number>(0);

  const refreshSession = useCallback(async () => {
    try {
      const data = await getTarotApi<UnlockedSessionPayload>('/api/auth/session');
      setSession({
        loading: false,
        unlocked: Boolean(data.unlocked),
        isTestBuyer: Boolean(data.isTestBuyer),
        tiradasRestantesHoy:
          typeof data.tiradasRestantesHoy === 'number' ? data.tiradasRestantesHoy : null,
        maxTiradasPorDia: data.maxTiradasPorDia || 5,
        maxMensajesPorTirada: data.maxMensajesPorTirada || 10,
      });
    } catch {
      setSession((prev) => ({
        ...prev,
        loading: false,
        unlocked: false,
      }));
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const handleUnlocked = (payload: UnlockedSessionPayload) => {
    setSession({
      loading: false,
      unlocked: Boolean(payload.unlocked),
      isTestBuyer: Boolean(payload.isTestBuyer),
      tiradasRestantesHoy:
        typeof payload.tiradasRestantesHoy === 'number' ? payload.tiradasRestantesHoy : 5,
      maxTiradasPorDia: payload.maxTiradasPorDia || 5,
      maxMensajesPorTirada: payload.maxMensajesPorTirada || 10,
    });
    setActivationNotice('¡Listo! Tu acceso está activo');
    setActiveTab('tres_cartas');
  };

  const handleSessionExpired = () => {
    setSession((prev) => ({
      ...prev,
      loading: false,
      unlocked: false,
      isTestBuyer: false,
      tiradasRestantesHoy: null,
    }));
  };

  const handleLogout = async () => {
    try {
      await postTarotApi('/api/auth/logout', {});
    } catch {
      // Limpiar estado local igualmente
    }
    handleSessionExpired();
  };

  const handleUpdateRemainingSpreads = (remaining: number) => {
    setSession((prev) => ({
      ...prev,
      tiradasRestantesHoy: remaining,
    }));
  };

  const handleStartChatFromFreeCard = (
    tema: TarotTema,
    pregunta: string,
    carta: { numero: number; nombre: string }
  ) => {
    setSessionTema(tema);
    setSessionPregunta(pregunta);
    setSessionCartas([
      {
        numero: carta.numero,
        nombre: carta.nombre,
        posicion: 'Carta Gratis Revelada',
      },
    ]);
    setSessionTiradaId(undefined);
    setSessionMensajesRestantes(session.maxMensajesPorTirada);
    setChatSessionKey((prev) => prev + 1);
    setActiveTab('chat');
  };

  const handleStartChatFromThreeCards = (
    tema: TarotTema,
    pregunta: string,
    cartas: Array<{ numero: number; nombre: string; posicion?: string }>,
    tiradaId?: string,
    mensajesRestantes?: number
  ) => {
    setSessionTema(tema);
    setSessionPregunta(pregunta);
    setSessionCartas(cartas);
    setSessionTiradaId(tiradaId);
    setSessionMensajesRestantes(mensajesRestantes ?? session.maxMensajesPorTirada);
    setChatSessionKey((prev) => prev + 1);
    setActiveTab('chat');
  };

  const handleClearChatSession = () => {
    setSessionCartas([]);
    setSessionPregunta('');
    setSessionTiradaId(undefined);
    setSessionMensajesRestantes(session.maxMensajesPorTirada);
    setChatSessionKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0712] text-[#E0D8C8] font-sans selection:bg-[#D4AF37]/30 selection:text-[#F3E5AB] relative overflow-x-hidden">
      {/* Background Starlight Dot Matrix */}
      <div className="fixed inset-0 w-full h-full opacity-20 pointer-events-none z-0 bg-starlight-pattern" />

      {/* Background celestial ambient radial glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[45rem] h-[30rem] bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.07)_0%,_transparent_70%)] blur-2xl" />
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#2A2050]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-[32rem] h-[32rem] bg-[#1A1435]/30 rounded-full blur-3xl" />
      </div>

      {/* Main Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        unlocked={session.unlocked}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10">
        {activeTab === 'carta_gratis' && (
          <FreeCardReading
            onStartChatWithReading={handleStartChatFromFreeCard}
            onGoToThreeCards={() => setActiveTab('tres_cartas')}
          />
        )}

        {activeTab === 'tres_cartas' && (
          <ThreeCardReading
            session={session}
            activationNotice={activationNotice}
            onDismissActivationNotice={() => setActivationNotice(null)}
            onUnlocked={handleUnlocked}
            onSessionExpired={handleSessionExpired}
            onUpdateRemainingSpreads={handleUpdateRemainingSpreads}
            onStartChatWithReading={handleStartChatFromThreeCards}
          />
        )}

        {activeTab === 'chat' && (
          <LunaChat
            key={chatSessionKey}
            session={session}
            tema={sessionTema}
            preguntaInicial={sessionPregunta}
            cartasPrevias={sessionCartas}
            tiradaId={sessionTiradaId}
            initialMensajesRestantes={sessionMensajesRestantes}
            onUnlocked={handleUnlocked}
            onSessionExpired={handleSessionExpired}
            onGoToThreeCards={() => setActiveTab('tres_cartas')}
            onClearSession={handleClearChatSession}
          />
        )}

        {activeTab === 'grimoire' && <ArcanosGrimoire />}
      </main>

      {/* Artistic Flair Ethical & Safety Footer */}
      <footer className="w-full border-t border-[#D4AF37]/15 bg-[#0A0712]/95 py-6 px-4 relative z-10 mt-auto text-center backdrop-blur-sm">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-[#D4AF37] font-cinzel font-semibold tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            <span>Ética & Marco de Interpretación Simbólica de Luna</span>
          </div>
          <p className="text-[11px] text-[#E0D8C8]/60 max-w-2xl mx-auto leading-relaxed">
            Las lecturas de Luna en "As de Júpiter" son herramientas de reflexión simbólica y autoconocimiento basadas en la tradición del Tarot de Marsella. No constituyen predicciones infalibles, diagnósticos médicos, ni reemplazan asesoramiento profesional.
          </p>
          <div className="pt-2 text-[10px] text-[#D4AF37]/60 flex items-center justify-center gap-4 uppercase tracking-wider font-mono">
            <span>As de Júpiter © 2026</span>
          </div>
        </div>
      </footer>

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
