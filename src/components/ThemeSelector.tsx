import React from 'react';
import { Heart, Coins, Sparkles, Users } from 'lucide-react';
import { TarotTema } from '../types/tarot';

interface ThemeSelectorProps {
  selectedTema: TarotTema;
  onSelectTema: (tema: TarotTema) => void;
  disabled?: boolean;
}

const TEMAS: Array<{
  id: TarotTema;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  accent: string;
}> = [
  {
    id: 'amor',
    label: 'Amor & Vínculos',
    sublabel: 'Relaciones, sentimientos y elecciones',
    icon: Heart,
    accent: 'bg-gradient-to-br from-[#2A2050] to-[#151025] text-[#E0D8C8] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]',
  },
  {
    id: 'dinero',
    label: 'Dinero & Proyectos',
    sublabel: 'Recursos, estabilidad y decisiones materiales',
    icon: Coins,
    accent: 'bg-gradient-to-br from-[#2A2050] to-[#151025] text-[#E0D8C8] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]',
  },
  {
    id: 'futuro',
    label: 'Futuro & Destino',
    sublabel: 'Rumbo, ciclos y transformaciones',
    icon: Sparkles,
    accent: 'bg-gradient-to-br from-[#2A2050] to-[#151025] text-[#E0D8C8] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]',
  },
  {
    id: 'familia',
    label: 'Familia & Hogar',
    sublabel: 'Raíces, roles y dinámicas compartidas',
    icon: Users,
    accent: 'bg-gradient-to-br from-[#2A2050] to-[#151025] text-[#E0D8C8] border-[#D4AF37] ring-1 ring-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]',
  },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  selectedTema,
  onSelectTema,
  disabled = false,
}) => {
  return (
    <div className="w-full">
      <label className="block font-cinzel text-xs uppercase tracking-[0.2em] text-[#D4AF37] mb-3">
        1. Selecciona el Tema de Consulta
      </label>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TEMAS.map((t) => {
          const Icon = t.icon;
          const isSelected = selectedTema === t.id;
          return (
            <button
              key={t.id}
              id={`theme-btn-${t.id}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTema(t.id)}
              className={`relative p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer flex flex-col justify-between group ${
                isSelected
                  ? t.accent
                  : 'bg-[#151025]/70 border-[#D4AF37]/20 text-[#E0D8C8]/80 hover:bg-[#1A1435] hover:border-[#D4AF37]/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="font-cinzel font-semibold text-sm tracking-wide text-[#E0D8C8] group-hover:text-[#D4AF37] transition-colors">
                  {t.label}
                </span>
                <Icon
                  className={`w-4 h-4 ${
                    isSelected ? 'text-[#D4AF37]' : 'text-[#D4AF37]/50 group-hover:text-[#D4AF37]'
                  } transition-colors`}
                />
              </div>
              <p className="text-xs text-[#E0D8C8]/60 leading-tight">
                {t.sublabel}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
