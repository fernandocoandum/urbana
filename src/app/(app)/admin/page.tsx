import type { Metadata } from 'next';
import { Container, PageHeader } from '@/components/layout/page';
import { VisaoGeral } from '@/features/admin/components/visao-geral';
import { dataDeHojeExtenso } from '@/lib/format';

export const metadata: Metadata = { title: 'Visão geral · Urbana' };

export default function Page() {
  return (
    <Container size="admin">
      <PageHeader title="Visão geral" description={`Como está a operação · ${dataDeHojeExtenso()}`} />
      <VisaoGeral />
    </Container>
  );
}
