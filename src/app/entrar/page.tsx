import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { getCurrentUser } from '@/features/auth/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Entrar · Urbana' };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ reset?: string | string[] }> }) {
  const { reset } = await searchParams;
  const token = Array.isArray(reset) ? reset[0] : reset;
  // Quem já tem sessão vai direto para o painel (exceto ao abrir um link de redefinição de senha).
  if (!token && (await getCurrentUser())) redirect('/');
  return <AuthScreen resetToken={token} />;
}
