import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-7" aria-hidden />
      </span>
      <h3 className="mt-5 text-xl font-semibold">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-base text-fg-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
