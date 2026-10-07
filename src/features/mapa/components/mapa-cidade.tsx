'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { DivIcon, FeatureGroup, HeatLayer, Map as LeafletMap, Marker, MarkerClusterGroup, Popup } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { loadLeaflet, type LeafletNS } from '../leaflet-loader';
import { CENTRO_CIDADE, MAPA_COR_STATUS, pesoCalor, posicaoDoPonto, tamanhoCluster, type PontoMapa } from '../mapa-utils';
import { MapaPopup } from './mapa-popup';

export type ModoMapa = 'pontos' | 'calor';

export interface MapaCidadeProps {
  pontos: PontoMapa[];
  modo: ModoMapa;
  admin: boolean;
  /** Muda a cada pedido de "ir para": o mapa voa até `centro`. */
  foco?: { centro: [number, number]; nonce: number } | null;
  onVerDetalhes: (id: string) => void;
  onApoiar: (id: string) => Promise<{ apoiado: boolean; total: number } | null>;
  className?: string;
}

// Gradiente do calor: do azul suave ao vermelho, sem o verde-limão padrão do leaflet.heat.
const GRADIENTE_CALOR = { 0.2: '#60a5fa', 0.4: '#34d399', 0.6: '#facc15', 0.8: '#f97316', 1: '#dc2626' };

function iconeDoPonto(L: LeafletNS, cor: string, aproximado: boolean): DivIcon {
  const dot = document.createElement('div');
  dot.className = aproximado ? 'urbana-dot urbana-dot--aprox' : 'urbana-dot';
  dot.style.setProperty('--dot', cor);
  return L.divIcon({ className: 'urbana-dot-wrap', html: dot, iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12] });
}

function iconeDoCluster(L: LeafletNS, n: number): DivIcon {
  const tam = tamanhoCluster(n);
  const el = document.createElement('div');
  el.className = 'urbana-cluster';
  el.textContent = String(n);
  return L.divIcon({ className: 'urbana-cluster-wrap', html: el, iconSize: [tam, tam] });
}

export default function MapaCidade({ pontos, modo, admin, foco, onVerDetalhes, onApoiar, className }: MapaCidadeProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const libRef = useRef<LeafletNS | null>(null);
  const camadaRef = useRef<FeatureGroup | MarkerClusterGroup | HeatLayer | null>(null);
  const roots = useRef(new Map<Popup, Root>());
  const marcadores = useRef(new Map<string, Marker>());
  const abertoId = useRef<string | null>(null);
  const enquadrou = useRef(false);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  // Sobe quando o container ganha tamanho depois de o calor ter sido adiado (canvas de 0x0).
  const [versao, setVersao] = useState(0);
  const calorAdiado = useRef(false);

  // Callbacks por ref: as camadas não são recriadas quando só o handler muda.
  const cb = useRef({ onVerDetalhes, onApoiar, admin });
  useEffect(() => { cb.current = { onVerDetalhes, onApoiar, admin }; }, [onVerDetalhes, onApoiar, admin]);

  // Cria o mapa (e carrega os plugins) uma vez.
  useEffect(() => {
    let cancelado = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const L = await loadLeaflet(); // já traz markercluster e heat registrados
      const el = host.current;
      if (cancelado || !el) return;
      libRef.current = L;
      const map = L.map(el, { center: CENTRO_CIDADE, zoom: 14, zoomControl: false, attributionControl: true, zoomSnap: 0.5 });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      ro = new ResizeObserver(() => {
        map.invalidateSize();
        const t = map.getSize();
        if (calorAdiado.current && t.x > 0 && t.y > 0) { calorAdiado.current = false; setVersao((v) => v + 1); }
      });
      ro.observe(el);
      setPronto(true);
    })().catch((e) => {
      // Sem rede para o chunk (ou plugin ausente): mostra o aviso e permite tentar de novo.
      console.error('Falha ao carregar o mapa:', e);
      if (!cancelado) setFalhou(true);
    });
    const abertos = roots.current;
    return () => {
      cancelado = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      camadaRef.current = null;
      enquadrou.current = false;
      calorAdiado.current = false;
      abertoId.current = null;
      setPronto(false);
      abertos.forEach((r) => setTimeout(() => r.unmount(), 0));
      abertos.clear();
    };
  }, [tentativa]);

  // (Re)cria a camada ativa: clusters no modo pontos, calor no modo calor — nunca as duas.
  useEffect(() => {
    const map = mapRef.current;
    const L = libRef.current;
    if (!pronto || !map || !L) return;
    // Se um popup está aberto, reabre-o depois de recriar a camada (ex.: dados novos do servidor).
    const reabrir = abertoId.current;
    // Fecha o popup e solta os roots da camada antiga: `removeLayer` nem sempre dispara `popupclose`.
    map.closePopup();
    if (camadaRef.current) { map.removeLayer(camadaRef.current); camadaRef.current = null; }
    roots.current.forEach((r) => setTimeout(() => r.unmount(), 0));
    roots.current.clear();
    marcadores.current.clear();
    abertoId.current = null;
    // O container pode ter mudado de tamanho (painel, troca de modo): o canvas do calor nasce com ele.
    map.invalidateSize();
    calorAdiado.current = false;
    const posicoes = pontos.map((p) => ({ p, pos: posicaoDoPonto(p) }));
    // Na primeira carga com dados, enquadra todos os pontos (sem animar).
    if (!enquadrou.current && posicoes.length > 0) {
      enquadrou.current = true;
      map.fitBounds(L.latLngBounds(posicoes.map(({ pos }) => [pos.lat, pos.lng] as [number, number])), { paddingTopLeft: [window.innerWidth >= 768 ? 360 : 56, 72], paddingBottomRight: [56, 56], maxZoom: 15, animate: false });
    }

    if (modo === 'calor') {
      if (posicoes.length === 0) return; // sem pontos não há o que desenhar (e heatLayer([]) é frágil)
      const t = map.getSize();
      if (t.x === 0 || t.y === 0) { calorAdiado.current = true; return; } // canvas 0x0 estoura; o ResizeObserver reentra
      const heat = L.heatLayer(posicoes.map(({ p, pos }) => [pos.lat, pos.lng, pesoCalor(p.apoios)]), { radius: 28, blur: 22, maxZoom: 17, minOpacity: 0.35, gradient: GRADIENTE_CALOR });
      heat.addTo(map);
      camadaRef.current = heat;
      return;
    }

    const grupo = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 48,
      iconCreateFunction: (c) => iconeDoCluster(L, c.getChildCount()),
    });
    for (const { p, pos } of posicoes) {
      const marker: Marker = L.marker([pos.lat, pos.lng], {
        icon: iconeDoPonto(L, MAPA_COR_STATUS[p.status] ?? '#94a3b8', pos.aproximado),
        title: `${p.titulo} (${p.status})`,
        riseOnHover: true,
      });
      const popup = L.popup({ minWidth: 248, maxWidth: 280, closeButton: true, autoPanPadding: [24, 24], offset: [0, 2] });
      marker.bindPopup(popup);
      marcadores.current.set(p.id, marker);
      marker.on('popupopen', () => {
        abertoId.current = p.id;
        // Conteúdo React num nó DOM (createRoot); flushSync para o Leaflet medir o tamanho certo.
        const node = document.createElement('div');
        const root = createRoot(node);
        roots.current.set(popup, root);
        flushSync(() =>
          root.render(
            <MapaPopup
              ponto={p}
              aproximado={pos.aproximado}
              admin={cb.current.admin}
              onVerDetalhes={(id) => { map.closePopup(); cb.current.onVerDetalhes(id); }}
              onApoiar={(id) => cb.current.onApoiar(id)}
              onResize={() => popup.update()}
            />,
          ),
        );
        popup.setContent(node);
      });
      marker.on('popupclose', () => {
        if (abertoId.current === p.id) abertoId.current = null;
        const root = roots.current.get(popup);
        roots.current.delete(popup);
        if (root) setTimeout(() => root.unmount(), 0);
      });
      grupo.addLayer(marker);
    }
    grupo.addTo(map);
    camadaRef.current = grupo;
    // Só reabre se o ponto continua no filtro atual.
    if (reabrir) marcadores.current.get(reabrir)?.openPopup();
  }, [pronto, pontos, modo, versao]);

  // "Por bairro": voa até o centro escolhido.
  useEffect(() => {
    const map = mapRef.current;
    if (!pronto || !map || !foco) return;
    map.flyTo(foco.centro, 15, { duration: 0.8 });
  }, [pronto, foco]);

  return (
    <div className={cn('relative h-full w-full', className)}>
      <div ref={host} role="application" aria-label="Mapa das ocorrências da cidade" className="isolate z-0 h-full w-full bg-surface-2" />
      {falhou && (
        <div role="alert" className="absolute inset-0 z-10 grid place-items-center bg-surface-2/90 p-6">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <p className="text-base font-semibold">Não foi possível carregar o mapa.</p>
            <p className="text-sm text-fg-muted">Verifique sua conexão e tente de novo.</p>
            <Button size="sm" variant="secondary" onClick={() => { setFalhou(false); setTentativa((n) => n + 1); }}>Tentar de novo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
