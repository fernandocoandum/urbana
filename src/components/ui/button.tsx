import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium outline-none transition-[background-color,color,transform,box-shadow] duration-150 focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg shadow-xs hover:bg-primary-hover',
        secondary: 'bg-surface-2 text-fg hover:bg-border',
        ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        danger: 'bg-danger text-primary-fg shadow-xs hover:brightness-110',
      },
      size: {
        sm: 'h-9 px-4 text-sm [&_svg]:size-4',
        md: 'h-11 px-5 text-base',
        lg: 'h-[52px] px-7 text-base',
        icon: 'size-11 rounded-full',
        'icon-sm': 'size-9 rounded-full [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ className, variant, size, asChild, loading, disabled, children, type = 'button', ref, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} ref={ref as Ref<HTMLElement>} {...(props as object)}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
