import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/features/auth/server';
import { ListaView } from '@/features/ocorrencias/components/lista-view';

export const metadata: Metadata = { title: 'Minhas ocorrências · Urbana' };

export default async function Page() {
  if ((await getCurrentUser())?.role === 'admin') redirect('/admin/ocorrencias');
  return <ListaView />;
}
