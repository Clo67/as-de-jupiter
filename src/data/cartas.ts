import cartasData from './cartas_conocimiento.json';
import { CartaConocimiento, CartasBaseData } from '../types/tarot';

export const CARTAS_BASE: CartasBaseData = cartasData as unknown as CartasBaseData;
export const TODAS_LAS_CARTAS: CartaConocimiento[] = CARTAS_BASE.cartas;

export const NUMEROS_ROMANOS: Record<number, string> = {
  0: '0',
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
  10: 'X',
  11: 'XI',
  12: 'XII',
  13: 'XIII',
  14: 'XIV',
  15: 'XV',
  16: 'XVI',
  17: 'XVII',
  18: 'XVIII',
  19: 'XIX',
  20: 'XX',
  21: 'XXI',
};

// Colors and visual archetype metadata for cards
export const SIMBOLOS_CARTAS: Record<number, { iconName: string; arcanoColor: string }> = {
  0: { iconName: 'Compass', arcanoColor: 'from-amber-500/20 to-emerald-500/20' },
  1: { iconName: 'Sparkles', arcanoColor: 'from-amber-400/20 to-yellow-600/20' },
  2: { iconName: 'Scroll', arcanoColor: 'from-indigo-400/20 to-purple-600/20' },
  3: { iconName: 'Crown', arcanoColor: 'from-emerald-400/20 to-teal-600/20' },
  4: { iconName: 'Shield', arcanoColor: 'from-red-400/20 to-amber-700/20' },
  5: { iconName: 'BookOpen', arcanoColor: 'from-blue-400/20 to-indigo-700/20' },
  6: { iconName: 'HeartHandshake', arcanoColor: 'from-rose-400/20 to-pink-600/20' },
  7: { iconName: 'Zap', arcanoColor: 'from-amber-500/20 to-orange-600/20' },
  8: { iconName: 'Scale', arcanoColor: 'from-sky-400/20 to-cyan-600/20' },
  9: { iconName: 'Lantern', arcanoColor: 'from-amber-200/20 to-stone-700/20' },
  10: { iconName: 'RotateCw', arcanoColor: 'from-purple-400/20 to-violet-700/20' },
  11: { iconName: 'Flame', arcanoColor: 'from-amber-500/20 to-rose-600/20' },
  12: { iconName: 'Anchor', arcanoColor: 'from-cyan-400/20 to-blue-700/20' },
  13: { iconName: 'RefreshCw', arcanoColor: 'from-slate-400/20 to-zinc-800/20' },
  14: { iconName: 'Droplets', arcanoColor: 'from-teal-400/20 to-cyan-600/20' },
  15: { iconName: 'Lock', arcanoColor: 'from-rose-600/20 to-red-950/20' },
  16: { iconName: 'AlertTriangle', arcanoColor: 'from-orange-500/20 to-red-600/20' },
  17: { iconName: 'Star', arcanoColor: 'from-amber-300/20 to-yellow-500/20' },
  18: { iconName: 'Moon', arcanoColor: 'from-indigo-400/20 to-blue-900/20' },
  19: { iconName: 'Sun', arcanoColor: 'from-yellow-400/20 to-amber-600/20' },
  20: { iconName: 'Bell', arcanoColor: 'from-violet-400/20 to-purple-800/20' },
  21: { iconName: 'Globe', arcanoColor: 'from-emerald-400/20 to-indigo-600/20' },
};

export function obtenerCartaPorNumero(numero: number): CartaConocimiento | undefined {
  return TODAS_LAS_CARTAS.find(c => c.numero === numero);
}

export function obtenerCartaPorNombre(nombre: string): CartaConocimiento | undefined {
  const norm = nombre.toLowerCase().trim();
  return TODAS_LAS_CARTAS.find(c => c.nombre.toLowerCase().trim() === norm || norm.includes(c.nombre.toLowerCase().trim()));
}

export function formatConsejoCartaTitulo(nombre: string): string {
  const trimmed = nombre.trim();
  if (trimmed.startsWith('El ')) {
    return `Consejo del ${trimmed.slice(3)}`;
  }
  if (trimmed.startsWith('La ')) {
    return `Consejo de la ${trimmed.slice(3)}`;
  }
  return `Consejo de ${trimmed}`;
}
