import React, { useEffect, useState } from 'react';
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
  lazy?: boolean;
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
  lazy = false,
  size = 'md',
  onClick,
  className = '',
}) => {
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    setImgStatus('loading');
  }, [numero]);

  const meta = SIMBOLOS_CARTAS[numero] || { iconName: 'Star', arcanoColor: 'from-[#1A1133] to-[#4B3B7E]' };
  const IconComponent = ICON_MAP[meta.iconName] || Star;
  const roman = NUMEROS_ROMANOS[numero] || `${numero}`;
  const imageSrc = `/cards/${String(numero).padStart(2, '0')}.jpg`;

  const sizeClasses = {
    sm: 'w-32 h-52 text-xs',
    md: 'w-44 h-72 text-sm',
    lg: 'w-56 sm:w-64 h-[22rem] sm:h-[25rem] text-base',
  }[size];

  const hasImage = imgStatus === 'loaded';

  return (
    <div
      id={`tarot-card-${numero}`}
      onClick={onClick}
      className={`relative select-none perspective-[1200px] ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <motion.div
        initial={false}
        animate={{ rotateY: isRevealed ? 0 : 180 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className={`relative ${sizeClasses} rounded-xl transform-gpu transition-all duration-300 preserve-3d`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Card Front */}
        <div
          className={`absolute inset-0 w-full h-full rounded-xl flex flex-col justify-between border-2 border-[#D4AF37]/65 bg-gradient-to-b from-[#2A2050] via-[#1A1435] to-[#151025] shadow-[0_0_25px_rgba(212,175,55,0.2)] backdrop-blur-md overflow-hidden ${
            size === 'sm' ? 'p-2.5' : 'p-3.5'
          } ${isRevealed ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Real deck image from /public/cards/00.jpg..21.jpg when present */}
          {imgStatus !== 'error' && (
            <img
              src={imageSrc}
              alt={`${roman} - ${nombre}`}
              loading={lazy ? 'lazy' : 'eager'}
              decoding="async"
              onLoad={() => setImgStatus('loaded')}
              onError={() => setImgStatus('error')}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-0 ${
                hasImage ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          {/* Subtle gradient overlay when image is visible so labels stay crisp */}
          {hasImage && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85 pointer-events-none z-10" />
          )}

          {/* Subtle ornate inner gold frame */}
          <div className="absolute inset-1.5 rounded-lg border border-[#D4AF37]/35 pointer-events-none z-20" />
          <div className="absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 border-[#D4AF37] z-20 pointer-events-none" />
          <div className="absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 border-[#D4AF37] z-20 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 border-[#D4AF37] z-20 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 border-[#D4AF37] z-20 pointer-events-none" />

          {/* Top header: Roman numeral and position */}
          <div className="flex items-center justify-between z-20 px-1 pt-0.5 gap-1">
            <span className="font-cinzel text-[#D4AF37] font-bold tracking-widest text-xs sm:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {roman}
            </span>
            {posicion && (
              <span className="text-[9px] uppercase font-bold text-black bg-[#D4AF37] px-2 py-0.5 rounded-full tracking-tight truncate max-w-[120px] shadow-sm">
                {posicion}
              </span>
            )}
          </div>

          {/* Central Artwork/Symbol Fallback (shown when image is absent or loading) */}
          <div
            className={`relative flex-1 flex flex-col items-center justify-center my-1.5 z-20 transition-opacity duration-200 ${
              hasImage ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div
              className={`${
                size === 'lg' ? 'w-20 h-20 sm:w-24 sm:h-24' : size === 'md' ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-14 h-14'
              } rounded-full border-2 border-[#D4AF37] p-1 flex items-center justify-center bg-gradient-to-tr from-[#1A1133] to-[#4B3B7E] shadow-[0_0_15px_rgba(212,175,55,0.3)] group-hover:scale-105 transition-transform`}
            >
              <IconComponent
                className={`${
                  size === 'lg' ? 'w-10 h-10 sm:w-12 sm:h-12' : size === 'md' ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-7 h-7'
                } text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.7)]`}
              />
            </div>

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

          {/* Card Footer: Full Name (never truncated) */}
          <div className="z-20 text-center pb-0.5 px-1">
            <div className="h-px w-3/4 mx-auto bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent mb-1" />
            <h4
              className={`font-cinzel font-bold text-[#E0D8C8] uppercase leading-tight break-words drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] ${
                size === 'sm' ? 'text-[10px] tracking-wide' : 'text-xs sm:text-sm tracking-wider'
              }`}
            >
              {nombre}
            </h4>
            <p className="text-[8px] text-[#D4AF37]/85 tracking-[0.18em] uppercase font-serif mt-0.5">
              Arcano Mayor
            </p>
          </div>
        </div>

        {/* Card Back (Hidden/Face down) */}
        <div
          className="absolute inset-0 w-full h-full rounded-xl p-3 flex flex-col items-center justify-center border-2 border-[#D4AF37]/50 bg-gradient-to-br from-[#1A1435] via-[#151025] to-[#0A0712] shadow-2xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Ornate back pattern */}
          <div className="absolute inset-2 rounded-lg border border-[#D4AF37]/25 flex items-center justify-center">
            <div className="absolute inset-2 rounded-md border border-[#D4AF37]/15" />
            <div className="w-16 h-16 rounded-full border-2 border-[#D4AF37]/45 flex items-center justify-center bg-[#1A1133]/80 shadow-[0_0_15px_rgba(212,175,55,0.18)]">
              <Eye className="w-7 h-7 text-[#D4AF37] animate-pulse" />
            </div>
          </div>
          <span className="font-cinzel text-xs text-[#D4AF37]/75 uppercase tracking-[0.2em] z-10 mt-24 font-serif">
            As de Júpiter
          </span>
        </div>
      </motion.div>
    </div>
  );
};
