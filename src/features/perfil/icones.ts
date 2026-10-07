import { Building2, Check, Eye, Flag, Handshake, Heart, Shield, Sprout, type LucideIcon } from 'lucide-react';
import type { ConquistaIcone } from './conquistas';
import type { NivelIcone } from './nivel';

export const NIVEL_ICONE: Record<NivelIcone, LucideIcon> = {
  sprout: Sprout,
  building: Building2,
  handshake: Handshake,
  shield: Shield,
};

export const CONQUISTA_ICONE: Record<ConquistaIcone, LucideIcon> = {
  flag: Flag,
  eye: Eye,
  check: Check,
  heart: Heart,
  shield: Shield,
};
