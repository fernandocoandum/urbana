import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/features/auth/server';
import { NovaOcorrenciaWizard } from '@/features/ocorrencias/wizard/wizard';
import { CATEGORIAS_VALIDAS } from '@/lib/constants';

export const metadata: Metadata = { title: 'Nova ocorrência · Urbana' };

export default async function Page({ searchParams }: { searchParams: Promise<{ categoria?: string | string[] }> }) {
  if ((await getCurrentUser())?.role === 'admin') redirect('/admin');
  // Atalho da tela inicial: ?categoria= já escolhe a categoria e abre no passo do local.
  const { categoria } = await searchParams;
  const inicial = typeof categoria === 'string' && CATEGORIAS_VALIDAS.has(categoria) ? categoria : undefined;
  return <NovaOcorrenciaWizard categoriaInicial={inicial} />;
}
