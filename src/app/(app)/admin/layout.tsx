import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/features/auth/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect('/inicio');
  return children;
}
