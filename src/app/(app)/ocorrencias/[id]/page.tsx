import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/features/auth/server';
import { DetalheView } from '@/features/ocorrencias/components/detalhe-view';

export const metadata: Metadata = { title: 'Ocorrência · Urbana' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if ((await getCurrentUser())?.role === 'admin') redirect(`/admin/ocorrencias/${encodeURIComponent(id)}`);
  return <DetalheView id={id} />;
}
