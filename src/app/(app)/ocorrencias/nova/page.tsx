import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/features/auth/server';
import { NovaOcorrenciaWizard } from '@/features/ocorrencias/wizard/wizard';

export const metadata: Metadata = { title: 'Nova ocorrência · Urbana' };

export default async function Page() {
  if ((await getCurrentUser())?.role === 'admin') redirect('/admin');
  return <NovaOcorrenciaWizard />;
}
