import { cn } from '@/lib/utils';

/** Placeholder com shimmer — a única animação infinita permitida. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton-shimmer rounded-md', className)} {...props} />;
}
