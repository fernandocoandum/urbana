'use client';

import { Award, Bell, ClipboardList, Home, Inbox, Map as MapIcon, MessageSquare, Moon, Plus, Search, Settings, Sprout, Sun, UserRound, Handshake, Shield, Star } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AnimatedList, BlurText, CountUp } from '@/components/bits';
import { Container, Section } from '@/components/layout/page';
import { AnimatedTabs, AnimatedTabsPanel } from '@/components/ui/animated-tabs';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { PasswordStrength } from '@/components/ui/password-strength';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProfileCard } from '@/components/ui/profile-card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { StepperStatus } from '@/components/ui/stepper-status';
import { Tip } from '@/components/ui/tooltip';
import { BAIRROS, CATEGORIAS, STATUS_LISTA } from '@/features/ocorrencias/categorias';
import { Sound } from '@/lib/sound';

const SCALE = [
  { cls: 'text-caption font-medium tracking-[.02em]', nome: 'caption 12/16 · 500', amostra: 'LEGENDA DO MAPA' },
  { cls: 'text-sm font-medium', nome: 'sm 14/20 · 500', amostra: 'Meta, rótulos e badges' },
  { cls: 'text-base', nome: 'base 16/26 · 400', amostra: 'Corpo de texto e inputs. Registre um problema na rua em menos de um minuto.' },
  { cls: 'text-lg font-medium', nome: 'lg 18/28 · 500', amostra: 'Lead e título de item de lista' },
  { cls: 'text-xl font-semibold', nome: 'xl 20/28 · 600', amostra: 'Título de card' },
  { cls: 'text-2xl font-semibold tracking-[-.01em]', nome: '2xl 24/32 · 600', amostra: 'Título de seção' },
  { cls: 'text-3xl font-semibold tracking-[-.015em]', nome: '3xl 30/38 · 600', amostra: 'Título de página' },
  { cls: 'text-4xl font-[650] tracking-[-.015em]', nome: '4xl 36/44 · 650', amostra: 'Boa tarde, Fernando' },
];

const TOKENS: [string, string][] = [
  ['bg', 'bg-bg'], ['surface', 'bg-surface'], ['surface-2', 'bg-surface-2'], ['border', 'bg-border'], ['fg', 'bg-fg'], ['fg-muted', 'bg-fg-muted'],
  ['primary', 'bg-primary'], ['primary-soft', 'bg-primary-soft'], ['success', 'bg-success'], ['warning', 'bg-warning'], ['danger', 'bg-danger'],
];

const noop = () => () => {};
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

function Bloco({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <Section title={titulo}>
      <Card className={className}>{children}</Card>
    </Section>
  );
}

export function DevUiShowcase() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [senha, setSenha] = useState('');
  const [aba, setAba] = useState('todas');
  const [statusDemo, setStatusDemo] = useState<string>('Em análise');
  const [erro, setErro] = useState(true);
  const [pwReal, setPwReal] = useState('Urbana#2026x');

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <p className="hidden text-lg font-semibold sm:block">Urbana · vitrine de UI</p>
          <AnimatedTabs
            aria-label="Tema"
            value={mounted ? (theme ?? 'light') : 'light'}
            onValueChange={setTheme}
            tabs={[
              { value: 'light', label: 'Claro', icon: Sun },
              { value: 'dark', label: 'Escuro', icon: Moon },
              { value: 'system', label: 'Sistema' },
            ]}
          />
        </div>
      </header>

      <Container>
        <h1 className="text-3xl font-semibold tracking-[-.015em]">Sistema de design</h1>
        <p className="mt-2 max-w-[680px] text-base text-fg-muted">Figtree Variable, tema claro por padrão, raios generosos e movimento com molas. Esta página existe só para revisão visual.</p>

        <Bloco titulo="Tipografia" className="space-y-5">
          {SCALE.map((s) => (
            <div key={s.nome} className="grid gap-1 sm:grid-cols-[170px_1fr] sm:items-baseline sm:gap-6">
              <span className="font-protocol text-sm text-fg-muted">{s.nome}</span>
              <span className={s.cls}>{s.amostra}</span>
            </div>
          ))}
          <p className="font-protocol text-lg">PROT-2026-0042 · protocolo em fonte mono</p>
          <p className="tabular text-2xl font-semibold">1.248 · 36 · 07 (tabular-nums)</p>
        </Bloco>

        <Bloco titulo="Cores">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {TOKENS.map(([n, c]) => (
              <div key={n} className="flex flex-col gap-2">
                <div className={`h-14 rounded-lg border border-border ${c}`} />
                <span className="text-sm text-fg-muted">{n}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {STATUS_LISTA.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {CATEGORIAS.map((c) => (
              <span key={c} className="inline-flex items-center gap-2 text-sm font-medium">
                <CategoryIcon categoria={c} size="sm" />
                {c}
              </span>
            ))}
          </div>
        </Bloco>

        <Bloco titulo="Botões" className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger">Perigo</Button>
            <Button loading>Enviando</Button>
            <Button disabled>Desabilitado</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Pequeno 36</Button>
            <Button size="md">Médio 44</Button>
            <Button size="lg">Grande 52</Button>
            <Button size="icon" aria-label="Adicionar"><Plus /></Button>
            <Button size="icon-sm" variant="secondary" aria-label="Buscar"><Search /></Button>
          </div>
        </Bloco>

        <Bloco titulo="Campos" className="grid gap-6 md:grid-cols-2">
          <Field label="Título" htmlFor="d-titulo" hint="Resuma o problema em poucas palavras.">
            <Input id="d-titulo" placeholder="Ex.: Buraco na Rua João Machado" />
          </Field>
          <Field label="Bairro" htmlFor="d-bairro">
            <Select id="d-bairro" defaultValue="">
              <option value="" disabled>Selecione</option>
              {BAIRROS.map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label="E-mail" htmlFor="d-email" error={erro ? 'Informe um e-mail válido.' : null}>
            <Input id="d-email" aria-invalid={erro} defaultValue="fernando@" onChange={() => setErro(false)} />
          </Field>
          <Field label="Descrição" htmlFor="d-desc" optional>
            <Textarea id="d-desc" placeholder="Conte o que está acontecendo" />
          </Field>
        </Bloco>

        <Bloco titulo="Medidor de senha">
          <div className="grid gap-8 md:grid-cols-2">
            <Field label="Crie uma senha" htmlFor="d-senha">
              <PasswordStrength id="d-senha" value={senha} onChange={setSenha} contexto={{ nome: 'Fernando Coan', email: 'fernando@exemplo.com' }} placeholder="Digite para ver o medidor" />
            </Field>
            <Field label="Exemplo preenchido" htmlFor="d-senha2">
              <PasswordStrength id="d-senha2" value={pwReal} onChange={setPwReal} />
            </Field>
          </div>
        </Bloco>

        <Bloco titulo="Abas" className="space-y-8">
          <AnimatedTabs
            aria-label="Filtro de ocorrências"
            value={aba}
            onValueChange={setAba}
            tabs={[{ value: 'todas', label: 'Todas', count: 12 }, { value: 'andamento', label: 'Em andamento', count: 5 }, { value: 'resolvidas', label: 'Resolvidas', count: 7 }]}
          />
          <AnimatedTabs variant="underline" aria-label="Seções do perfil" defaultValue="atividade" tabs={[{ value: 'atividade', label: 'Atividade' }, { value: 'progresso', label: 'Progresso' }, { value: 'conta', label: 'Conta' }]}>
            <AnimatedTabsPanel value="atividade" className="pt-4 text-base text-fg-muted">Painel de atividade.</AnimatedTabsPanel>
            <AnimatedTabsPanel value="progresso" className="pt-4 text-base text-fg-muted">Painel de progresso.</AnimatedTabsPanel>
            <AnimatedTabsPanel value="conta" className="pt-4 text-base text-fg-muted">Painel da conta.</AnimatedTabsPanel>
          </AnimatedTabs>
          <ExpandableTabs
            tabs={[{ title: 'Início', icon: Home }, { title: 'Ocorrências', icon: ClipboardList }, { type: 'separator' }, { title: 'Mapa', icon: MapIcon }, { title: 'Conversa', icon: MessageSquare }]}
          />
        </Bloco>

        <Bloco titulo="Menus, popover, tooltip e diálogos" className="flex flex-wrap items-center gap-3">
          <Menu>
            <MenuTrigger asChild><Button variant="secondary">Abrir menu</Button></MenuTrigger>
            <MenuContent align="start">
              <MenuLabel><p className="text-base font-semibold">Fernando Coan</p><p className="text-sm text-fg-muted">fernando@exemplo.com</p></MenuLabel>
              <MenuSeparator />
              <MenuItem icon={UserRound}>Meu perfil</MenuItem>
              <MenuItem icon={Settings}>Configurações</MenuItem>
              <MenuItem icon={Bell} checked>Notificações</MenuItem>
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger asChild><Button variant="secondary">Popover</Button></PopoverTrigger>
            <PopoverContent align="start" className="p-5">
              <p className="text-base font-semibold">Notificações</p>
              <p className="mt-1 text-sm text-fg-muted">Nada novo por aqui.</p>
            </PopoverContent>
          </Popover>
          <Tip label="Dica rápida"><Button variant="ghost">Tooltip</Button></Tip>
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Dialog</Button></DialogTrigger>
            <DialogContent
              title="Enviar sem foto?"
              description="A foto ajuda a prefeitura a localizar o problema, mas você pode enviar assim mesmo."
              footer={<><DialogClose asChild><Button variant="secondary">Voltar</Button></DialogClose><DialogClose asChild><Button>Enviar sem foto</Button></DialogClose></>}
            />
          </Dialog>
          <Sheet>
            <SheetTrigger asChild><Button variant="secondary">Sheet lateral</Button></SheetTrigger>
            <SheetContent title="Filtros" description="Refine a lista de ocorrências."><p className="text-base text-fg-muted">Conteúdo do painel.</p></SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild><Button variant="secondary">Sheet inferior</Button></SheetTrigger>
            <SheetContent side="bottom" title="Camadas do mapa"><p className="pb-4 text-base text-fg-muted">Conteúdo do painel inferior.</p></SheetContent>
          </Sheet>
          <Button variant="secondary" onClick={() => toast.success('Ocorrência registrada', { description: 'Protocolo PROT-2026-0042' })}>Toast</Button>
          <Button variant="secondary" onClick={() => Sound.play('notify')}>Som</Button>
        </Bloco>

        <Bloco titulo="Status e andamento" className="space-y-6">
          <AnimatedTabs aria-label="Status de exemplo" value={statusDemo} onValueChange={setStatusDemo} tabs={STATUS_LISTA.map((s) => ({ value: s, label: s }))} className="overflow-x-auto" />
          <StepperStatus status={statusDemo} />
        </Bloco>

        <Bloco titulo="Métricas, saudação e lista animada" className="space-y-8">
          <BlurText text="Boa tarde, Fernando" animateBy="words" delay={120} className="text-4xl font-[650] tracking-[-.015em]" />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[['Total', 128], ['Em análise', 14], ['Em atendimento', 9], ['Resolvidas', 97]].map(([r, n]) => (
              <div key={r}>
                <p className="text-sm text-fg-muted">{r}</p>
                <p className="tabular text-3xl font-semibold tracking-[-.015em]"><CountUp to={n as number} duration={1.4} /></p>
              </div>
            ))}
          </div>
          <AnimatedList
            className="rounded-xl border border-border"
            maxHeight={240}
            items={[
              { t: 'PROT-2026-0001: Em atendimento', d: 'Equipe de campo em ação' },
              { t: 'Nova mensagem da prefeitura (PROT-2026-0002)', d: 'Precisamos de uma referência mais precisa do local.' },
              { t: 'PROT-2026-0003: Resolvida', d: 'Resolvida — avalie o atendimento' },
              { t: 'PROT-2026-0004: Encaminhada', d: 'Encaminhada para Secretaria de Obras' },
            ]}
            getKey={(i) => i.t}
            renderItem={(i) => (
              <div className="border-b border-border px-4 py-3 last:border-b-0">
                <p className="text-sm font-semibold">{i.t}</p>
                <p className="line-clamp-2 text-sm text-fg-muted">{i.d}</p>
              </div>
            )}
          />
        </Bloco>

        <Bloco titulo="Cards, avatares e estados" className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><div><CardTitle>Card padrão</CardTitle><CardDescription>Padding 24, raio 20.</CardDescription></div><StatusBadge status="Em análise" /></CardHeader>
              <p className="text-base text-fg-muted">Conteúdo do card com respiro generoso.</p>
            </Card>
            <Card interactive>
              <CardHeader><div><CardTitle>Card interativo</CardTitle><CardDescription>Passe o mouse: y −1 e sombra.</CardDescription></div></CardHeader>
              <div className="flex items-center gap-3"><CategoryIcon categoria="Pavimentação" /><Avatar nome="Maria Souza" /><Avatar nome="Fernando Coan" size="sm" /></div>
            </Card>
          </div>
          <div className="space-y-3"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
          <EmptyState icon={Inbox} title="Nenhuma ocorrência ainda" description="Quando você registrar um problema na rua, ele aparece aqui." action={<Button><Plus />Nova ocorrência</Button>} />
        </Bloco>

        <Section title="Cartão de perfil">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <ProfileCard
              nome="Fernando Coan"
              titulo={<><Award className="size-5" />Cidadão ativo</>}
              meta="Centro · Membro desde out. de 2026"
              metricas={[{ valor: 12, rotulo: 'Ocorrências' }, { valor: 7, rotulo: 'Resolvidas' }, { valor: 31, rotulo: 'Apoios dados' }]}
              badges={[
                { icon: Sprout, label: 'Primeiro registro' },
                { icon: Star, label: 'Olho vivo' },
                { icon: Handshake, label: 'Vizinho solidário' },
                { icon: Shield, label: 'Guardião', locked: true, hint: 'Alcance o nível 4' },
              ]}
              onEditPhoto={() => toast('Trocar foto')}
              acoes={<><Button size="lg"><Plus />Nova ocorrência</Button><Button size="lg" variant="secondary">Editar perfil</Button></>}
            />
            <ProfileCard variant="compact" nome="Maria Souza" titulo={<><Award className="size-5" />Vizinha atenta</>} metricas={[{ valor: 4, rotulo: 'Ocorrências' }, { valor: 2, rotulo: 'Resolvidas' }, { valor: 9, rotulo: 'Apoios' }]} badges={[{ icon: Sprout, label: 'Primeiro registro' }]} />
          </div>
        </Section>
      </Container>
    </div>
  );
}
