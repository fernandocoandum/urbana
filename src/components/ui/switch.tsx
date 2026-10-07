'use client';

import { motion } from 'motion/react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Interruptor (Radix Switch) com o polegar deslizando em spring snappy. Alvo de toque de 44px via padding. */
export function Switch({ checked, onCheckedChange, id, 'aria-label': ariaLabel, className }: { checked: boolean; onCheckedChange: (v: boolean) => void; id?: string; 'aria-label'?: string; className?: string }) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-transparent outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-primary/25',
        checked ? 'bg-primary' : 'bg-border-strong',
        className,
      )}
    >
      <SwitchPrimitive.Thumb asChild>
        <motion.span className="block size-6 rounded-full bg-white shadow-sm" initial={false} animate={{ x: checked ? 24 : 0 }} transition={spring.snappy} />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
