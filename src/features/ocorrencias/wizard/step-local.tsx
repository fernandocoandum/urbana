'use client';

import { LoaderCircle, LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { MiniMapa } from '@/features/mapa/components/mini-mapa-lazy';
import { centroDoBairro } from '@/features/mapa/mapa-utils';
import { api } from '@/lib/api-client';
import { BAIRROS } from '../categorias';
import { enderecoDoGps, escolherBairro, coordenadasComoTexto, interpretarSugestao, type GeocodeReverso } from './geo';
import type { Acao, WizardState } from './state';

interface Sugestao { lat: number; lng: number; nome: string }

/** Passo 2: bairro, endereço (com sugestões), GPS e mini-mapa com pin arrastável. */
export function StepLocal({ s, dispatch }: { s: WizardState; dispatch: (a: Acao) => void }) {
  const [status, setStatus] = useState('');
  const [buscandoGps, setBuscandoGps] = useState(false);
  const faltaBairro = s.tentou && !s.bairro;
  const faltaEndereco = s.tentou && !s.endereco.trim();

  // Mesma lógica do `usarLocalizacao` do legado: GPS → reverse geocode pelo servidor → preenche.
  function usarLocalizacao() {
    if (!navigator.geolocation) { toast.error('Seu navegador não suporta geolocalização.'); return; }
    setBuscandoGps(true);
    setStatus('Obtendo sua localização...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        dispatch({ type: 'local', lat: latitude, lng: longitude, precisao: 'gps' });
        setStatus('Identificando o endereço...');
        try {
          // Consulta feita pelo servidor (proxy), nunca direto ao Nominatim: respeita a CSP.
          const data = await api<GeocodeReverso>('GET', `/api/geocode?lat=${latitude}&lng=${longitude}`);
          dispatch({ type: 'campo', campo: 'endereco', valor: enderecoDoGps(data, latitude, longitude) });
          const bairro = escolherBairro(data.bairroDetectado);
          if (bairro) dispatch({ type: 'campo', campo: 'bairro', valor: bairro });
          setStatus('Endereço preenchido pela sua localização (GPS) — confira antes de continuar.');
          toast.success('Localização aplicada!');
        } catch {
          dispatch({ type: 'campo', campo: 'endereco', valor: coordenadasComoTexto(latitude, longitude) });
          setStatus('Localização capturada, mas não deu pra identificar o endereço — confira/edite abaixo.');
        } finally {
          setBuscandoGps(false);
        }
      },
      (err) => {
        setBuscandoGps(false);
        setStatus('');
        toast.error(err.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter sua localização.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const temPonto = s.lat !== null && s.lng !== null;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button id="btn-geo" type="button" variant="secondary" onClick={usarLocalizacao} disabled={buscandoGps}>
          {buscandoGps ? <LoaderCircle className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
          Usar minha localização
        </Button>
        <p id="geo-status" role="status" className="mt-3 min-h-5 text-sm text-fg-muted">{status}</p>
      </div>

      <Field label="Bairro" htmlFor="f-bairro" error={faltaBairro ? 'Escolha o bairro.' : null}>
        <Select id="f-bairro" aria-invalid={faltaBairro || undefined} value={s.bairro} onChange={(e) => dispatch({ type: 'campo', campo: 'bairro', valor: e.target.value })}>
          <option value="">Selecione...</option>
          {BAIRROS.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </Field>

      <EnderecoField s={s} dispatch={dispatch} invalido={faltaEndereco} />

      <div>
        <MiniMapa
          lat={s.lat}
          lng={s.lng}
          centro={centroDoBairro(s.bairro)}
          zoom={17}
          interactive
          editavel
          onPick={(lat, lng) => dispatch({ type: 'local', lat, lng, precisao: 'manual' })}
          label="Mapa para marcar o local da ocorrência"
        />
        <p className="mt-3 text-sm text-fg-muted">
          {temPonto ? 'Arraste o pin para ajustar o ponto exato.' : 'Toque no mapa para marcar o ponto exato (opcional).'}
        </p>
      </div>
    </div>
  );
}

function EnderecoField({ s, dispatch, invalido }: { s: WizardState; dispatch: (a: Acao) => void; invalido: boolean }) {
  // Sugestões só enquanto a pessoa digita; escolher uma (ou usar o GPS) encerra a busca.
  const [digitando, setDigitando] = useState(false);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const termo = s.endereco.trim();

  useEffect(() => {
    if (!digitando || termo.length < 3) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const r = await api<Sugestao[]>('GET', `/api/geocode?q=${encodeURIComponent(termo)}`);
        if (!cancelado) { setSugestoes(Array.isArray(r) ? r : []); setAberto(true); }
      } catch {
        if (!cancelado) setSugestoes([]); // sugestão é só ajuda: sem ela, segue digitando
      }
    }, 400);
    return () => { cancelado = true; clearTimeout(t); };
  }, [termo, digitando]);

  function escolher(sug: Sugestao) {
    const { endereco, bairro } = interpretarSugestao(sug.nome);
    dispatch({ type: 'campo', campo: 'endereco', valor: endereco });
    if (bairro) dispatch({ type: 'campo', campo: 'bairro', valor: bairro });
    dispatch({ type: 'local', lat: sug.lat, lng: sug.lng, precisao: 'manual' });
    setDigitando(false);
    setAberto(false);
    setSugestoes([]);
  }

  const mostrar = aberto && digitando && termo.length >= 3 && sugestoes.length > 0;
  return (
    <Field label="Endereço" htmlFor="f-endereco" hint="Rua e número" error={invalido ? 'Informe o endereço.' : null}>
      <div
        className="relative"
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false); }}
      >
        <Input
          id="f-endereco"
          placeholder="Rua, número"
          autoComplete="off"
          aria-invalid={invalido || undefined}
          value={s.endereco}
          onFocus={() => setAberto(true)}
          onChange={(e) => { setDigitando(true); dispatch({ type: 'campo', campo: 'endereco', valor: e.target.value }); }}
        />
        {mostrar && (
          <ul aria-label="Sugestões de endereço" className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
            {sugestoes.map((sug) => (
              <li key={`${sug.lat},${sug.lng},${sug.nome}`}>
                <button type="button" onClick={() => escolher(sug)} className="w-full rounded-lg px-3 py-2.5 text-left text-sm outline-none hover:bg-surface-2 focus-visible:bg-surface-2">
                  {sug.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
