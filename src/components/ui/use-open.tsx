'use client';

import { useCallback, useState } from 'react';

/** Estado aberto/fechado controlado ou não, para os overlays animados com AnimatePresence. */
export function useOpenState(open: boolean | undefined, defaultOpen: boolean | undefined, onOpenChange?: (o: boolean) => void) {
  const [inner, setInner] = useState(defaultOpen ?? false);
  const controlled = open !== undefined;
  const current = controlled ? open : inner;
  const set = useCallback(
    (v: boolean) => {
      if (!controlled) setInner(v);
      onOpenChange?.(v);
    },
    [controlled, onOpenChange],
  );
  return [current, set] as const;
}
