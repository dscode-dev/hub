'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Radar de cobertura em SVG puro.
 *
 * Responde a uma pergunta que nenhum numero isolado responde: a operacao esta
 * apoiada em quantas frentes? Um poligono esticado num eixo so mostra
 * concentracao - e concentracao e risco.
 */

export interface RadarPoint {
  label: string;
  /** Participacao de 0 a 1. */
  value: number;
  /** Texto auxiliar mostrado na legenda. */
  detail?: string;
}

interface RadarChartProps {
  points: RadarPoint[];
  className?: string;
}

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 88;
const RINGS = 4;

export function RadarChart({ points, className }: RadarChartProps) {
  const id = useId();

  /*
   * Com menos de tres eixos nao existe poligono - viraria uma linha ou um
   * ponto. Nesse caso a leitura honesta e a lista, nao um radar degenerado.
   */
  if (points.length < 3) {
    return (
      <ul className={cn('flex flex-col gap-3', className)}>
        {points.map((point) => (
          <li key={point.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-foreground">{point.label}</span>
              <span className="tabular-nums text-foreground-muted">
                {Math.round(point.value * 100)}%
              </span>
            </div>

            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(point.value * 100, 2)}%` }}
              />
            </div>

            {point.detail ? (
              <p className="mt-1 text-xs text-foreground-subtle">{point.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  // Comeca no topo (-90deg) para o primeiro eixo cair onde o olho procura.
  const angleOf = (index: number) => (index / points.length) * Math.PI * 2 - Math.PI / 2;

  const coordinate = (index: number, ratio: number) => {
    const angle = angleOf(index);

    return [CENTER + Math.cos(angle) * RADIUS * ratio, CENTER + Math.sin(angle) * RADIUS * ratio];
  };

  const polygon = (ratio: (index: number) => number) =>
    points
      .map((_, index) => {
        const [x, y] = coordinate(index, ratio(index));
        return `${x},${y}`;
      })
      .join(' ');

  const maxValue = Math.max(...points.map((point) => point.value), 0);
  // Normaliza pela maior fatia: com participacoes baixas o poligono ficaria
  // colado no centro e ilegivel.
  const scale = maxValue > 0 ? 1 / maxValue : 1;

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-full max-w-[260px]"
        role="img"
        aria-label={`Radar de cobertura: ${points.map((point) => point.label).join(', ')}`}
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {Array.from({ length: RINGS }).map((_, ring) => (
          <polygon
            key={ring}
            points={polygon(() => (ring + 1) / RINGS)}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="1"
          />
        ))}

        {points.map((point, index) => {
          const [x, y] = coordinate(index, 1);

          return (
            <line
              key={point.label}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={polygon((index) => (points[index]?.value ?? 0) * scale)}
          fill={`url(#${id}-area)`}
          stroke="var(--color-brand-600)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {points.map((point, index) => {
          const [x, y] = coordinate(index, (point.value ?? 0) * scale);

          return (
            <circle
              key={point.label}
              cx={x}
              cy={y}
              r="3.5"
              fill="var(--color-surface)"
              stroke="var(--color-brand-600)"
              strokeWidth="2"
            />
          );
        })}
      </svg>

      <ul className="grid w-full gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {points.map((point) => (
          <li key={point.label} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-foreground-muted">{point.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              {Math.round(point.value * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
