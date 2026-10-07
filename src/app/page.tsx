import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/features/auth/server';

export const dynamic = 'force-dynamic';

/**
 * Raiz: preserva os links de e-mail antigos (`/?reset=TOKEN`) e despacha por sessão —
 * morador para /inicio, admin para /admin, visitante para /entrar.
 */
export default async function Home({ searchParams }: { searchParams: Promise<{ reset?: string | string[] }> }) {
  const { reset } = await searchParams;
  const token = Array.isArray(reset) ? reset[0] : reset;
  if (token) redirect(`/entrar?reset=${encodeURIComponent(token)}`);
  const user = await getCurrentUser();
  if (!user) redirect('/entrar');
  redirect(user.role === 'admin' ? '/admin' : '/inicio');
}
