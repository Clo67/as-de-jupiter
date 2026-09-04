export type TarotTema = 'amor' | 'dinero' | 'futuro' | 'familia';

export interface CartaConocimiento {
  numero: number;
  nombre: string;
  palabras_clave: string[];
  significado_general: string;
  aspecto_positivo: string;
  aspecto_desafiante: string;
  temas: {
    amor: string;
    dinero: string;
    futuro: string;
    familia: string;
  };
  consejo: string;
}

export interface CartasBaseData {
  _meta?: {
    fuente: string;
    estado: string;
    sistema_invertidas: string;
    campos_omitidos: string;
    version: string;
    ultima_actualizacion: string;
  };
  cartas: CartaConocimiento[];
}

// Schemas according to Luna specification
export interface CartaGratisResponse {
  carta: {
    numero: number;
    nombre: string;
  };
  interpretacion_breve: string;
}

export interface CartaEnTirada {
  posicion: string;
  numero: number;
  nombre: string;
  interpretacion: string;
}

export interface LecturaTresCartasResponse {
  cartas: CartaEnTirada[];
  cierre_narrativo: string;
}

export interface CartaNuevaChat {
  numero: number;
  nombre: string;
  motivo?: string;
}

export interface ChatConsultaResponse {
  respuesta: string;
  cartas_nuevas?: CartaNuevaChat[];
}

export type TipoTirada = 'carta_gratis' | 'tres_cartas' | 'chat';

export interface MensajeChat {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  cartasNuevas?: CartaNuevaChat[];
}
