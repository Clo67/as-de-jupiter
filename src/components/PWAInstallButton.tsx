import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#c49f2c] text-black text-xs font-cinzel font-bold tracking-wider transition-all shadow-[0_0_12px_rgba(212,175,55,0.3)] cursor-pointer"
        title="Instalar As de Júpiter"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-install-ios-btn"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#151025] hover:bg-[#1A1435] text-[#E0D8C8] text-xs font-cinzel font-semibold tracking-wider transition-all cursor-pointer"
        >
          <Share className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Instalar PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#151025] border border-[#D4AF37]/50 p-6 shadow-2xl relative space-y-4 text-center">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-black/50 text-[#E0D8C8]/70 hover:text-[#D4AF37]"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 mx-auto rounded-full bg-[#2A2050] border border-[#D4AF37] flex items-center justify-center text-[#D4AF37]">
                ☾
              </div>

              <h3 className="font-cinzel text-lg font-bold text-[#D4AF37]">
                Instalar As de Júpiter en iOS
              </h3>

              <div className="text-xs text-[#E0D8C8]/80 text-left space-y-2.5 font-serif bg-black/40 p-4 rounded-xl border border-[#D4AF37]/20">
                <p className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center text-[10px]">1</span>
                  Toca el botón <strong>Compartir</strong> (ícono cuadrado con flecha) en Safari.
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center text-[10px]">2</span>
                  Desliza hacia abajo y pulsa <strong>"Agregar al inicio"</strong>.
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center text-[10px]">3</span>
                  Confirma con el nombre <strong>"As de Júpiter"</strong>.
                </p>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-xl bg-[#D4AF37] text-black font-cinzel font-bold text-xs hover:bg-[#c49f2c] transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
