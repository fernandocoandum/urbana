import type * as Leaflet from 'leaflet';

export type LeafletNS = typeof Leaflet;

let loading: Promise<LeafletNS> | null = null;

/**
 * Carrega o Leaflet uma única vez e o expõe em `window.L` (os plugins — markercluster, heat — se
 * penduram no global). Só roda no navegador: chame dentro de `useEffect`. O build ESM do Leaflet
 * exporta um namespace congelado, então o global é uma cópia mutável que os plugins podem estender.
 * Os plugins são importados aqui, em sequência e só depois de `window.L` existir: se o bundler os
 * avaliasse antes, `L.markerClusterGroup`/`L.heatLayer` nunca seriam definidos.
 */
export function loadLeaflet(): Promise<LeafletNS> {
  if (!loading) {
    loading = (async () => {
      const mod = await import('leaflet');
      const base = ((mod as { default?: LeafletNS }).default ?? mod) as LeafletNS;
      const w = window as unknown as { L?: LeafletNS };
      if (!w.L) w.L = { ...base } as LeafletNS;
      await import('leaflet.markercluster');
      await import('leaflet.heat');
      const L = w.L;
      if (typeof L.markerClusterGroup !== 'function') throw new Error('Plugin leaflet.markercluster não foi registrado.');
      if (typeof L.heatLayer !== 'function') throw new Error('Plugin leaflet.heat não foi registrado.');
      return L;
    })();
    loading.catch(() => { loading = null; }); // permite tentar de novo se o chunk falhar
  }
  return loading;
}
