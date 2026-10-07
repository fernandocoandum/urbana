import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Container, PageHeader } from '@/components/layout/page';
import { FilaView } from '@/features/admin/components/fila-view';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Ocorrências · Urbana' };

export default function Page() {
  return (
    <Container size="admin">
      <PageHeader title="Ocorrências" description="Fila de atendimento: filtre, ordene e abra cada ocorrência para gerenciar." />
      {/* useSearchParams (filtros na URL) exige Suspense no Next 16 */}
      <Suspense fallback={<Skeleton aria-hidden className="h-64 rounded-xl" />}>
        <FilaView />
      </Suspense>
    </Container>
  );
}
