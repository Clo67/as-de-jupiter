import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface ShuffleAnimationProps {
  cantidad?: 1 | 3;
}

const READING_PROGRESS_MESSAGES = [
  'Luna está observando tus cartas...',
  'Las cartas empiezan a hablar entre sí...',
  'Luna está tejiendo tu lectura...',
];

export const ShuffleAnimation: React.FC<ShuffleAnimationProps> = ({ cantidad = 1 }) => {
  const cardOffsets = [-1, 0, 1];
  const [phaseIndex, setPhaseIndex] = useState<number>(-1);

  useEffect(() => {
    setPhaseIndex(-1);
    let intervalId: ReturnType<typeof setInterval> | undefined;

    // Después de la fase inicial de mezcla (~1.6s), rotar los mensajes cada pocos segundos
    const startTimer = setTimeout(() => {
      setPhaseIndex(0);
      intervalId = setInterval(() => {
        setPhaseIndex((prev) => (prev + 1) % READING_PROGRESS_MESSAGES.length);
      }, 3500);
    }, 1600);

    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [cantidad]);

  const primaryTitle =
    phaseIndex >= 0
      ? READING_PROGRESS_MESSAGES[phaseIndex]
      : cantidad === 3
        ? 'Mezclando los 22 Arcanos para tu tirada...'
        : 'Mezclando los 22 Arcanos Mayores...';

  const subtitleText =
    phaseIndex >= 0
      ? 'Cada carta conserva su simbolismo tradicional del Tarot de Marsella.'
      : cantidad === 3
        ? 'El azar elige tres cartas distintas y Luna prepara su lectura.'
        : 'Sacando una carta al azar y preparando la interpretación de Luna.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl bg-black/40 border border-[#D4AF37]/30 space-y-5"
    >
      <div className="relative w-40 h-44 flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.18)_0%,_transparent_70%)] rounded-full blur-xl pointer-events-none" />
        {cardOffsets.map((offset, index) => (
          <motion.div
            key={index}
            animate={{
              x: [offset * 14, -offset * 28, offset * 18, 0],
              y: [Math.abs(offset) * 3, -6, Math.abs(offset) * 2, 0],
              rotate: [offset * 7, -offset * 11, offset * 5, 0],
              scale: [1, 1.03, 0.99, 1],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: index * 0.12,
            }}
            className="absolute w-24 h-36 rounded-xl bg-gradient-to-br from-[#231942] via-[#151025] to-[#0A0712] border-2 border-[#D4AF37]/70 shadow-[0_8px_25px_rgba(0,0,0,0.6)] flex items-center justify-center"
            style={{ zIndex: 3 - Math.abs(offset) }}
          >
            <div className="w-18 h-28 rounded-lg border border-[#D4AF37]/35 flex flex-col items-center justify-center gap-1.5 bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.12)_0%,_transparent_70%)]">
              <Sparkles className="w-5 h-5 text-[#D4AF37]/80" />
              <span className="font-cinzel text-[8px] uppercase tracking-[0.22em] text-[#D4AF37]/70">
                Arcanos
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="text-center space-y-1 min-h-[3.25rem]">
        <AnimatePresence mode="wait">
          <motion.p
            key={primaryTitle}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35 }}
            className="font-cinzel text-sm text-[#D4AF37] tracking-[0.15em] uppercase"
          >
            {primaryTitle}
          </motion.p>
        </AnimatePresence>
        <p className="text-xs text-[#E0D8C8]/65 font-serif italic">{subtitleText}</p>
      </div>
    </motion.div>
  );
};
