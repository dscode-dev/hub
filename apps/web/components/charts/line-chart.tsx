'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Grafico de linhas em SVG puro.
 *
 * Sem biblioteca de grafico: o painel precisa de duas formas (linha e radar) e
 * uma dependencia de terceiros custaria centenas de KB no bundle, traria o
 * proprio vocabulario visual e ainda exigiria adaptacao aos tokens do design
 * system. O SVG e desenhado com a mesma paleta do resto da interface.
 *
 * O viewBox e fixo e o SVG escala junto com o container - por isso o grafico
 * responde a qualquer largura sem precisar medir o DOM.
 */

export interface LineSeries {
  label: string;
  values: number[];
  /** Cor da linha. Aceita qualquer valor CSS. */
  color: string;
  /** Preenche a area sob a linha. Use na serie principal. */
  filled?: boolean;
}

interface LineChartProps {
  labels: string[];
  series: LineSeries[];
  /** Formata o valor no eixo e na legenda de topo. */
  format?: (value: number) => string;
  className?: string;
}

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 16, right: 16, bottom: 30, left: 44 };
const GRID_LINES = 4;

export function LineChart({ labels, series, format = String, className }: LineChartProps) {
  const id = useId();

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const values = series.flatMap((item) => item.values);
  const rawMax = Math.max(...values, 0);
  /*
   * Escala sempre a partir do zero: comecar no minimo dos dados exagera
   * visualmente variacoes pequenas. O teto e arredondado para um numero
   * "redondo" para os rotulos do eixo nao virarem 143,33.
   */
  const max = niceCeiling(rawMax);

  const pointX = (index: number) =>
    PADDING.left + (labels.length <= 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);

  const pointY = (value: number) =>
    PADDING.top + plotHeight - (max === 0 ? 0 : (value / max) * plotHeight);

  return (
    <figure className={cn('w-full', className)}>
      <figcaption className="mb-3 flex flex-wrap items-center gap-4">
        {series.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Grafico de linhas: ${series.map((item) => item.label).join(' e ')}`}
      >
        <defs>
          {series.map((item, index) => (
            <linearGradient key={item.label} id={`${id}-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={item.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grade horizontal: referencia de leitura sem competir com os dados. */}
        {Array.from({ length: GRID_LINES + 1 }).map((_, index) => {
          const value = (max / GRID_LINES) * (GRID_LINES - index);
          const y = pointY(value);

          return (
            <g key={index}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={WIDTH - PADDING.right}
                y2={y}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-[var(--color-foreground-subtle)] text-[11px] tabular-nums"
              >
                {format(value)}
              </text>
            </g>
          );
        })}

        {series.map((item, index) => {
          const points = item.values.map((value, position) => [pointX(position), pointY(value)]);
          const line = points.map(([x, y]) => `${x},${y}`).join(' ');

          return (
            <g key={item.label}>
              {item.filled ? (
                <polygon
                  points={`${PADDING.left},${PADDING.top + plotHeight} ${line} ${
                    PADDING.left + plotWidth
                  },${PADDING.top + plotHeight}`}
                  fill={`url(#${id}-fill-${index})`}
                />
              ) : null}

              <polyline
                points={line}
                fill="none"
                stroke={item.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {points.map(([x, y], position) => (
                <circle
                  key={position}
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="var(--color-surface)"
                  stroke={item.color}
                  strokeWidth="2"
                />
              ))}
            </g>
          );
        })}

        {labels.map((label, index) => (
          <text
            key={label}
            x={pointX(index)}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="fill-[var(--color-foreground-subtle)] text-[11px]"
          >
            {label}
          </text>
        ))}
      </svg>
    </figure>
  );
}

/** Arredonda o teto do eixo para 1, 2 ou 5 vezes uma potencia de dez. */
function niceCeiling(value: number): number {
  if (value <= 0) {
    return 10;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return step * magnitude;
}
