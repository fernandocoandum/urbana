'use client';

import 'leaflet/dist/leaflet.css';
import type { DivIcon, Map as LeafletMap, Marker } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { loadLeaflet, type LeafletNS } from '../leaflet-loader';
import { CENTRO_CIDADE, COR_PIN_PADRAO } from '../mapa-utils';

export interface MiniMapaProps {
  lat?: number | null;
  lng?: number | null;
  /** Centro quando ainda não há ponto (ex.: centro do bairro escolhido). */
  centro?: [number, number];
  zoom?: number;
  /** Permite arrastar e dar zoom no mapa. Desligado = mapa estático (detalhe da ocorrência). */
  interactive?: boolean;
  /** Clique no mapa posiciona o pin e o pin pode ser arrastado; `onPick` recebe a posição. */
  editavel?: boolean;
  onPick?: (lat: number, lng: number) => void;
  /** Cor do pin (constante hex). */
  cor?: string;
  /** Texto para leitores de tela. */
  label: string;
  className?: string;
}

// O ícone é um nó DOM montado aqui, com a cor vinda de constante — nunca HTML de dados.
function criarPin(L: LeafletNS, cor: string): DivIcon {
  const pin = document.createElement('div');
  pin.className = 'urbana-pin';
  pin.style.setProperty('--pin', cor);
  pin.appendChild(document.createElement('span'));
  return L.divIcon({ className: 'urbana-pin-wrap', html: pin, iconSize: [32, 40], iconAnchor: [16, 38] });
}

const temPonto = (lat?: number | null, lng?: number | null): lat is number => typeof lat === 'number' && typeof lng === 'number';

export default function MiniMapa({ lat, lng, centro = CENTRO_CIDADE, zoom = 16, interactive = false, editavel = false, onPick, cor = COR_PIN_PADRAO, label, className }: MiniMapaProps) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const libRef = useRef<LeafletNS | null>(null);
  const pickRef = useRef(onPick);
  const primeiraVista = useRef(true);
  const [pronto, setPronto] = useState(false);

  useEffect(() => { pickRef.current = onPick; }, [onPick]);

  // Cria o mapa uma vez.
  useEffect(() => {
    let cancelado = false;
    let ro: ResizeObserver | null = null;
    loadLeaflet().then((L) => {
      const el = host.current;
      if (cancelado || !el) return;
      libRef.current = L;
      const map = L.map(el, {
        center: centro,
        zoom: 14,
        zoomControl: interactive,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: false,
        keyboard: interactive,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      if (editavel) map.on('click', (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(el);
      setPronto(true);
    });
    return () => {
      cancelado = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      setPronto(false);
    };
    // O mapa nasce uma vez; props de posição são tratadas no efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, editavel]);

  // Posição do pin e enquadramento.
  useEffect(() => {
    const map = mapRef.current;
    const L = libRef.current;
    if (!pronto || !map || !L) return;

    if (temPonto(lat, lng) && typeof lng === 'number') {
      const pos: [number, number] = [lat, lng];
      if (!markerRef.current) {
        const m = L.marker(pos, { icon: criarPin(L, cor), draggable: editavel, keyboard: false, autoPan: true }).addTo(map);
        if (editavel) m.on('dragend', () => { const p = m.getLatLng(); pickRef.current?.(p.lat, p.lng); });
        markerRef.current = m;
      } else {
        markerRef.current.setLatLng(pos);
        markerRef.current.setIcon(criarPin(L, cor));
      }
      if (primeiraVista.current) map.setView(pos, zoom, { animate: false });
      else if (!(map.getBounds().contains(pos) && map.getZoom() >= zoom - 1)) map.flyTo(pos, Math.max(map.getZoom(), zoom), { duration: 0.6 });
    } else {
      markerRef.current?.remove();
      markerRef.current = null;
      if (primeiraVista.current) map.setView(centro, 14, { animate: false });
      else map.flyTo(centro, 14, { duration: 0.6 });
    }
    primeiraVista.current = false;
  }, [pronto, lat, lng, centro, zoom, cor, editavel]);

  return (
    <div
      ref={host}
      role="application"
      aria-label={label}
      className={cn('isolate z-0 h-60 w-full overflow-hidden rounded-xl border border-border bg-surface-2', className)}
    />
  );
}
