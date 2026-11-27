import React, { useState } from 'react';
import {
  Lock,
  Sparkles,
  CheckCircle2,
  KeyRound,
  Mail,
  Hash,
  ExternalLink,
  AlertCircle,
  Compass,
  HelpCircle,
} from 'lucide-react';
import { CHECKOUT_URL, SUPPORT_EMAIL, PRODUCT_PRICE_LABEL } from '../config/commerceConfig';
import { postTarotApi, TarotApiError, LUNA_FRIENDLY_ERROR } from '../services/tarotApi';

export interface UnlockedSessionPayload {
  unlocked: boolean;
  isTestBuyer: boolean;
  tiradasRestantesHoy: number | null;
  maxTiradasPorDia: number;
  maxMensajesPorTirada: number;
}

interface PaywallGateProps {
  feature: 'tres_cartas' | 'chat';
  onUnlocked: (session: UnlockedSessionPayload) => void;
}

export const PaywallGate: React.FC<PaywallGateProps> = ({ feature, onUnlocked }) => {
  const [showActivateForm, setShowActivateForm] = useState(false);
  const [email, setEmail] = useState('');
  const [pedido, setPedido] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const isPlaceholderUrl = CHECKOUT_URL.includes('TU-LINK-DE-PAGO');

  const handleCheckoutClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isPlaceholderUrl) {
      e.preventDefault();
      setCheckoutNotice(
        'El enlace de pago se está configurando. Si ya tienes un código de acceso, usa la opción «Ya compré» abajo.'
      );
    }
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pedido.trim() || isSubmitting || activationSuccess) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await postTarotApi<{
        success: boolean;
        data: UnlockedSessionPayload;
      }>('/api/auth/activar', {
        email: email.trim(),
        pedido: pedido.trim(),
      });

      setActivationSuccess(true);
      setTimeout(() => {
        onUnlocked(response.data);
      }, 950);
    } catch (err: unknown) {
      if (err instanceof TarotApiError) {
        setError(err.message);
      } else {
        setError(LUNA_FRIENDLY_ERROR);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const featureTitle =
    feature === 'tres_cartas'
      ? 'Tirada Completa de 3 Cartas con Luna'
      : 'Chat de Consulta Privado con Luna';

  return (
    <div id="paywall-gate-section" className="w-full max-w-3xl mx-auto">
      <div className="bg-gradient-to-br from-[#151025]/95 via-[#1A1435]/95 to-[#0F0B1D]/95 border border-[#D4AF37]/35 rounded-2xl p-6 sm:p-9 shadow-2xl relative overflow-hidden space-y-7">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.12)_0%,_transparent_70%)] rounded-full blur-2xl pointer-events-none" />

        {activationSuccess ? (
          <div id="activation-success-panel" className="relative z-10 py-10 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-cinzel text-2xl sm:text-3xl font-light text-[#F3E5AB] tracking-[0.06em]">
              ¡Listo! Tu acceso está activo
            </h2>
            <p className="text-sm text-[#E0D8C8]/80 font-serif">
              Abriendo tu Tirada Completa de 3 Cartas con Luna...
            </p>
          </div>
        ) : (
          <>
            {/* Encabezado */}
            <div className="relative z-10 text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-cinzel font-semibold uppercase tracking-[0.15em]">
                <Lock className="w-3.5 h-3.5" />
                <span>Acceso Completo • {PRODUCT_PRICE_LABEL}</span>
              </div>

              <h2 className="font-cinzel text-2xl sm:text-3xl font-light text-[#D4AF37] tracking-[0.08em]">
                {featureTitle}
              </h2>

              <p className="text-sm sm:text-base text-[#E0D8C8]/80 max-w-xl mx-auto font-serif leading-relaxed">
                Con un único pago de <strong className="text-[#F3E5AB]">17 USD</strong> desbloqueas para siempre las dos experiencias completas de Luna en As de Júpiter:
              </p>
            </div>

            {/* Qué incluye */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-black/35 border border-[#D4AF37]/25 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-cinzel text-xs uppercase tracking-wider text-[#F3E5AB] font-bold">
                    Tirada Completa de 3 Cartas
                  </h3>
                  <p className="text-xs text-[#E0D8C8]/75 mt-1 font-serif leading-relaxed">
                    3 Arcanos sorteados al azar con interpretación profunda, símbolo clave y cierre narrativo. Hasta 5 tiradas por día.
                  </p>
                </div>
              </div>

              <div className="bg-black/35 border border-[#D4AF37]/25 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-cinzel text-xs uppercase tracking-wider text-[#F3E5AB] font-bold">
                    Chat con Luna sobre tus cartas
                  </h3>
                  <p className="text-xs text-[#E0D8C8]/75 mt-1 font-serif leading-relaxed">
                    Profundiza en tu lectura con hasta 10 consultas por cada tirada y carta complementaria al azar si hace falta.
                  </p>
                </div>
              </div>
            </div>

            {/* Botón principal de compra + botón Ya compré */}
            <div className="relative z-10 flex flex-col sm:flex-row gap-3 pt-1">
              <a
                id="unlock-checkout-btn"
                href={CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCheckoutClick}
                className="flex-1 py-4 px-6 rounded-xl font-cinzel font-bold text-black bg-[#D4AF37] hover:bg-[#c49f2c] shadow-[0_0_25px_rgba(212,175,55,0.28)] transition-all flex items-center justify-center gap-2.5 tracking-wider text-sm text-center"
              >
                <Sparkles className="w-4 h-4" />
                <span>Desbloquear (17 USD)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              <button
                id="toggle-already-purchased-btn"
                type="button"
                onClick={() => {
                  setShowActivateForm((prev) => !prev);
                  setError(null);
                }}
                className={`sm:w-auto px-5 py-4 rounded-xl font-cinzel font-semibold text-xs uppercase tracking-wider border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  showActivateForm
                    ? 'bg-[#2A2050] border-[#D4AF37] text-[#F3E5AB]'
                    : 'bg-black/40 border-[#D4AF37]/40 text-[#E0D8C8] hover:border-[#D4AF37] hover:text-[#D4AF37]'
                }`}
              >
                <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                <span>Ya compré</span>
              </button>
            </div>

            {checkoutNotice && (
              <p className="relative z-10 text-xs text-amber-200/90 text-center font-serif bg-amber-950/30 border border-amber-500/30 rounded-xl p-3">
                {checkoutNotice}
              </p>
            )}

            {/* Formulario "Ya compré" */}
            {showActivateForm && (
              <form
                id="activate-purchase-form"
                onSubmit={handleActivateSubmit}
                className="relative z-10 bg-black/45 border border-[#D4AF37]/30 rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <div className="space-y-1">
                  <h3 className="font-cinzel text-sm text-[#D4AF37] uppercase tracking-wider font-semibold">
                    Activar tu compra de Impultienda
                  </h3>
                  <p className="text-xs text-[#E0D8C8]/70 font-serif">
                    Ingresa el correo con el que pagaste y tu número de pedido. Tu sesión quedará guardada en este navegador.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="buyer-email-input"
                      className="flex items-center gap-1.5 text-[11px] font-cinzel uppercase tracking-wider text-[#D4AF37]"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email de compra</span>
                    </label>
                    <input
                      id="buyer-email-input"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      disabled={isSubmitting}
                      className="w-full bg-[#151025] border border-[#D4AF37]/30 rounded-xl px-3.5 py-2.5 text-sm text-[#E0D8C8] placeholder-[#E0D8C8]/30 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="buyer-order-input"
                      className="flex items-center gap-1.5 text-[11px] font-cinzel uppercase tracking-wider text-[#D4AF37]"
                    >
                      <Hash className="w-3.5 h-3.5" />
                      <span>Número de pedido</span>
                    </label>
                    <input
                      id="buyer-order-input"
                      type="text"
                      required
                      value={pedido}
                      onChange={(e) => setPedido(e.target.value)}
                      placeholder="Ej: 1048"
                      disabled={isSubmitting}
                      className="w-full bg-[#151025] border border-[#D4AF37]/30 rounded-xl px-3.5 py-2.5 text-sm text-[#E0D8C8] placeholder-[#E0D8C8]/30 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37]"
                    />
                    <p className="text-[11px] text-[#E0D8C8]/55 font-serif">
                      Lo encuentras en el mail de confirmación de tu compra en Impultienda (por ejemplo: «Pedido #1048»).
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-950/45 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                      'Ayuda con mi compra en As de Júpiter'
                    )}`}
                    className="text-xs text-[#E0D8C8]/65 hover:text-[#D4AF37] inline-flex items-center gap-1.5 transition-colors underline underline-offset-4"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>¿Problemas con tu compra? Escríbenos</span>
                  </a>

                  <button
                    id="submit-activate-purchase-btn"
                    type="submit"
                    disabled={isSubmitting || !email.trim() || !pedido.trim()}
                    className="px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-cinzel font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {isSubmitting ? (
                      <>
                        <Compass className="w-4 h-4 animate-spin" />
                        <span>Verificando compra...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Activar mi acceso</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
