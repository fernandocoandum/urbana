import { Hammer } from 'lucide-react';
import { Container, PageHeader } from './page';
import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';

/** Tela provisória: o conteúdo real chega nas etapas seguintes do plano. */
export function EmConstrucao({ titulo, descricao, size = 'citizen' }: { titulo: string; descricao: string; size?: 'citizen' | 'admin' | 'column' }) {
  return (
    <Container size={size}>
      <PageHeader title={titulo} description={descricao} />
      <Card>
        <EmptyState icon={Hammer} title="Esta tela está a caminho" description="A estrutura de navegação já está pronta; o conteúdo entra nas próximas etapas." />
      </Card>
    </Container>
  );
}
