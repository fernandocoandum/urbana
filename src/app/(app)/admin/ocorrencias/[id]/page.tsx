import type { Metadata } from 'next';
import { GestaoView } from '@/features/admin/components/gestao-view';

export const metadata: Metadata = { title: 'Gestão da ocorrência · Urbana' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GestaoView id={id} />;
}
