import type { PerfilStats } from './nivel';

export interface PerfilData {
  nome: string;
  email: string;
  foto: string | null;
  bairro: string;
  criadoEm: string | null;
  stats: Required<PerfilStats>;
  recentes: { id: string; protocolo: string; titulo: string; status: string; categoria: string; criadoEm: string }[];
}

export interface PerfilPublicoData {
  nome: string;
  foto: string | null;
  stats: Required<PerfilStats>;
}
