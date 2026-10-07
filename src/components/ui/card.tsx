import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Card: rounded-xl, borda, padding 24 (20 no mobile). `interactive` = y −1 + shadow-md em 160ms. */
export function Card({ className, interactive, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface p-5 shadow-xs sm:p-6',
        interactive && 'transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...props} />;
}
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-xl font-semibold', className)} {...props} />;
}
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-fg-muted', className)} {...props} />;
}
