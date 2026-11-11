import { useEffect, useId, useRef, useState } from 'react';
import type { Report } from '../../lib/types';
import { formatDate } from '../../lib/dates';

export function TrendChart({ report }: { report: Report }) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, entry.contentRect.width));
    });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const grouped = new Map<string, number[]>();
  for (const r of report.readings) grouped.set(r.date, [...(grouped.get(r.date) ?? []), r.value]);
  const points = Array.from(grouped, ([date, values]) => ({
    date,
    value: values.reduce((a, b) => a + b, 0) / values.length,
  }));
  if (!points.length) return null;
  const min = Math.max(0, Math.floor((Math.min(...points.map((p) => p.value)) - 20) / 20) * 20);
  const max = Math.ceil((Math.max(...points.map((p) => p.value)) + 20) / 20) * 20;
  const start = Date.parse(report.range.start),
    end = Date.parse(report.range.end);
  const x = (date: string) => 52 + ((Date.parse(date) - start) / (end - start || 1)) * (width - 84);
  const y = (value: number) => 210 - ((value - min) / (max - min)) * 170;
  return (
    <div className="chart-wrap" ref={container}>
      <svg viewBox={`0 0 ${width} 250`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Daily average glucose readings</title>
        <desc id={`${id}-desc`}>
          {points.map((p) => `${p.date}: ${p.value.toFixed(1)} mg/dl`).join('; ')}
        </desc>
        {Array.from({ length: 5 }, (_, i) => {
          const value = min + ((max - min) * i) / 4;
          return (
            <g key={i}>
              <line
                x1="52"
                x2={width - 32}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--line)"
                strokeDasharray="3 5"
              />
              <text x="38" y={y(value) + 4} textAnchor="end" className="chart-label">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        <polyline
          points={points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ')}
          fill="none"
          stroke="var(--green)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <g key={p.date}>
            <circle
              cx={x(p.date)}
              cy={y(p.value)}
              r="4"
              fill="var(--green)"
              stroke="white"
              strokeWidth="2"
            >
              <title>
                {formatDate(p.date)}: {p.value.toFixed(1)} mg/dl
              </title>
            </circle>
          </g>
        ))}
        <text x="52" y="239" className="chart-label">
          {formatDate(report.range.start, { day: 'numeric', month: 'short' })}
        </text>
        <text x={width - 32} y="239" textAnchor="end" className="chart-label">
          {formatDate(report.range.end, { day: 'numeric', month: 'short' })}
        </text>
      </svg>
      <p className="field-hint">
        Daily averages in mg/dl. Days without entries have no point; lines connect recorded days.
      </p>
    </div>
  );
}
