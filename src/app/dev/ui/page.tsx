import { notFound } from 'next/navigation';
import { vitrineLiberada } from './acesso';
import { DevUiShowcase } from './showcase';

// Vitrine de componentes para revisão visual. Responde 404 em produção na Vercel e, com
// `next start`, a não ser que URBANA_DEV_UI=1 (ver ./acesso.ts).
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Urbana — UI', robots: { index: false, follow: false } };

export default function Page() {
  if (!vitrineLiberada(process.env)) notFound();
  return <DevUiShowcase />;
}
