import { notFound } from 'next/navigation';
import { DevUiShowcase } from './showcase';

// Vitrine de componentes para revisão visual. Em produção responde 404, a não ser que
// URBANA_DEV_UI=1 (usado para conferir o visual com `next start` e tirar screenshots).
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Urbana — UI', robots: { index: false } };

export default function Page() {
  if (process.env.NODE_ENV === 'production' && process.env.URBANA_DEV_UI !== '1') notFound();
  return <DevUiShowcase />;
}
