import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/shell/admin-shell';
import { CitizenShell } from '@/components/shell/citizen-shell';
import { getCurrentUser } from '@/features/auth/server';
import { TermosGate } from '@/features/auth/components/termos-gate';
import { SessionProvider } from '@/features/auth/session-context';

// Lê o cookie de sessão a cada request: sem sessão, /entrar; com sessão, o shell do papel.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar');
  const Shell = user.role === 'admin' ? AdminShell : CitizenShell;
  return (
    <SessionProvider user={user}>
      <Shell>{children}</Shell>
      <TermosGate />
    </SessionProvider>
  );
}
