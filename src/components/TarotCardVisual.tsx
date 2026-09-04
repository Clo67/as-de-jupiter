import React from 'react';
import { motion } from 'motion/react';
import {
  Compass,
  Sparkles,
  Scroll,
  Crown,
  Shield,
  BookOpen,
  HeartHandshake,
  Zap,
  Scale,
  RotateCw,
  Flame,
  Anchor,
  RefreshCw,
  Droplets,
  Lock,
  AlertTriangle,
  Star,
  Moon,
  Sun,
  Bell,
  Globe,
  Eye,
} from 'lucide-react';
import { NUMEROS_ROMANOS, SIMBOLOS_CARTAS } from '../data/cartas';
import { CartaConocimiento } from '../types/tarot';

const ICON_MAP: Record<string, React.ElementType> = {
  Compass,
  Sparkles,
  Scroll,
  Crown,
  Shield,
  BookOpen,
  HeartHandshake,
  Zap,
  Scale,
  RotateCw,
  Flame,
  Anchor,
  RefreshCw,
  Droplets,
  Lock,
  AlertTriangle,
  Star,
  Moon,
  Sun,
  Bell,
  Globe,
};

interface TarotCardVisualProps {
  numero: number;
  nombre: string;
  posicion?: string;
  detalle?: CartaConocimiento | null;
  isRevealed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

export const TarotCardVisual: React.FC<TarotCardVisualProps> = ({
  numero,
  nombre,
  posicion,
  detalle,
  isRevealed = true,
  size = 'md',
  onClick,
  className = '',
}) => {
  const meta = SIMBOLOS_CARTAS[numero] || { iconName: 'Star', arcanoColor: 'from-[#1A1133] to-[#4B3B7E]' };
  const IconComponent = ICON_MAP[meta.iconName] || Star;
  const roman = NUMEROS_ROMANOS[numero] || `${numero}`;

  const sizeClasses = {
    sm: 'w-32 h-48 text-xs',
    md: 'w-44 h-68 text-sm',
    lg: 'w-56 h-88 text-base',
  }[size];

  return (
    <div
      id={`tarot-card-${numero}`}
      onClick={onClick}
      className={`relative select-none perspective-[1000px] ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <motion.div
        initial={false}
        animate={{ rotateY: isRevealed ? 0 : 180 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
        className={`relative ${sizeClasses} rounded-xl transform-gpu transition-all duration-300 preserve-3d`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Card Front */}
        <div
          className={`absolute inset-0 w-full h-full rounded-xl p-3.5 flex flex-col justify-between border-2 border-[#D4AF37]/60 bg-gradient-to-b from-[#2A2050] via-[#1A1435] to-[#151025] shadow-[0_0_25px_rgba(212,175,55,0.2)] backdrop-blur-md overflow-hidden ${
            isRevealed ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Subtle ornate inner gold frame */}
          <div className="absolute inset-1.5 rounded-lg border border-[#D4AF37]/30 pointer-events-none" />
          <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-[#D4AF37]" />
          <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-[#D4AF37]" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-[#D4AF37]" />
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-[#D4AF37]" />

          {/* Top header: Roman numeral and position */}
          <div className="flex items-center justify-between z-10 px-1 pt-1">
            <span className="font-cinzel text-[#D4AF37] font-bold tracking-widest text-xs sm:text-base drop-shadow-sm">
              {roman}
            </span>
            {posicion && (
              <span className="text-[9px] uppercase font-bold text-black bg-[#D4AF37] px-2 py-0.5 rounded-full tracking-tighter truncate max-w-[110px] shadow-sm">
                {posicion}
              </span>
            )}
          </div>

          {/* Central Artwork/Symbol */}
          <div className="relative flex-1 flex flex-col items-center justify-center my-2 z-10">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-[#D4AF37] p-1 flex items-center justify-center bg-gradient-to-tr from-[#1A1133] to-[#4B3B7E] shadow-[0_0_15px_rgba(212,175,55,0.3)] group-hover:scale-105 transition-transform"
            >
              <IconComponent className="w-8 h-8 sm:w-10 sm:h-10 text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.7)]" />
            </div>

            {/* Keywords pill preview */}
            {detalle && detalle.palabras_clave && size !== 'sm' && (
              <div className="mt-3 flex flex-wrap justify-center gap-1 px-1 max-h-12 overflow-hidden">
                {detalle.palabras_clave.slice(0, 2).map((kw, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-[#E0D8C8] bg-black/60 px-2 py-0.5 rounded-full border border-[#D4AF37]/30 tracking-tight"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Card Footer: Name */}
          <div className="z-10 text-center pb-1">
            <div className="h-px w-3/4 mx-auto bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent mb-1.5" />
            <h4 className="font-cinzel font-bold text-[#E0D8C8] text-xs sm:text-sm tracking-widest uppercase line-clamp-1">
              {nombre}
            </h4>
            <p className="text-[8px] text-[#D4AF37]/80 tracking-[0.2em] uppercase font-serif">
              Arcano Mayor
            </p>
          </div>
        </div>

        {/* Card Back (Hidden/Face down) */}
        <div
          className="absolute inset-0 w-full h-full rounded-xl p-3 flex flex-col items-center justify-center border-2 border-[#D4AF37]/40 bg-gradient-to-br from-[#1A1435] via-[#151025] to-[#0A0712] shadow-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Ornate back pattern */}
          <div className="absolute inset-2 rounded-lg border border-[#D4AF37]/20 flex items-center justify-center">
            <div className="absolute inset-2 rounded-md border border-[#D4AF37]/10" />
            <div className="w-16 h-16 rounded-full border-2 border-[#D4AF37]/40 flex items-center justify-center bg-[#1A1133]/80 shadow-[0_0_15px_rgba(212,175,55,0.15)]">
              <Eye className="w-7 h-7 text-[#D4AF37] animate-pulse" />
            </div>
          </div>
          <span className="font-cinzel text-xs text-[#D4AF37]/60 uppercase tracking-[0.2em] z-10 mt-20 font-serif">
            As de Júpiter
          </span>
        </div>
      </motion.div>
    </div>
  );
};
