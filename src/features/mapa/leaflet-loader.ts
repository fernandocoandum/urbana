import type * as Leaflet from 'leaflet';

export type LeafletNS = typeof Leaflet;

let loading: Promise<LeafletNS> | null = null;

/**
 * Carrega o Leaflet uma única vez e o expõe em `window.L` (os plugins — markercluster, heat — se
 * penduram no global). Só roda no navegador: chame dentro de `useEffect`. O build ESM do Leaflet
 * exporta um namespace congelado, então o global é uma cópia mutável que os plugins podem estender.
 */
export function loadLeaflet(): Promise<LeafletNS> {
  if (!loading) {
    loading = import('leaflet').then((mod) => {
      const base = ((mod as { default?: LeafletNS }).default ?? mod) as LeafletNS;
      const w = window as unknown as { L?: LeafletNS };
      if (!w.L) w.L = { ...base } as LeafletNS;
      return w.L;
    });
    loading.catch(() => { loading = null; }); // permite tentar de novo se o chunk falhar
  }
  return loading;
}
