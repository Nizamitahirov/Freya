'use client';

import { useMemo, useState } from 'react';
import {
  getDeductions,
  getEmployerCosts,
  superGross,
  planCompensation,
  type CompContext,
  type InputMode,
} from '@/lib/comp';

const fmt = (n: number) =>
  n.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ctx: CompContext = {
  sector: 'private',
  workplace: 'main',
  year: '2026',
  benefit: 200,
  unionPct: 0,
};

export default function CompCalculator() {
  const [currentGross, setCurrentGross] = useState(1000);
  const [currentMeal, setCurrentMeal] = useState(0);
  const [mode, setMode] = useState<InputMode>('percent');
  const [value, setValue] = useState(10);

  const current = useMemo(() => {
    const d = getDeductions(currentGross, ctx);
    return {
      net: d.net,
      gross: currentGross,
      superGross: superGross(currentGross, ctx),
      employer: getEmployerCosts(currentGross, ctx).total,
    };
  }, [currentGross]);

  const currentNet = current.net + currentMeal;

  const plan = useMemo(
    () =>
      planCompensation({
        mode,
        value,
        currentNet,
        currentGross,
        currentMeal,
        ctx,
        effectiveMonths: 12,
      }),
    [mode, value, currentNet, currentGross, currentMeal],
  );

  const deltaColor =
    plan.deltaGrossMonthly > 0
      ? 'var(--color-success)'
      : plan.deltaGrossMonthly < 0
        ? 'var(--color-destructive)'
        : 'var(--color-muted-foreground)';

  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--color-border)',
        padding: '1.5rem',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <h3 style={{ margin: '0 0 1rem', fontWeight: 700 }}>
        Canlı hesablama motoru · Net → Gross → SuperGross (private · 2026)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <label style={{ fontSize: 14 }}>
          Cari gross (₼)
          <input
            type="number"
            value={currentGross}
            onChange={(e) => setCurrentGross(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 14 }}>
          Cari yemək pulu (₼)
          <input
            type="number"
            value={currentMeal}
            onChange={(e) => setCurrentMeal(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', marginTop: '1rem' }}>
        <label style={{ fontSize: 14 }}>
          Giriş üsulu
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as InputMode)}
            style={inputStyle}
          >
            <option value="percent">Faizlə (%)</option>
            <option value="amount">Net artım (₼)</option>
            <option value="absolute">Yeni net (₼)</option>
          </select>
        </label>
        <label style={{ fontSize: 14, flex: 1 }}>
          Dəyər
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </label>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        <Panel title="Cari">
          <Row label="Net" value={fmt(currentNet)} />
          <Row label="Gross" value={fmt(current.gross)} />
          <Row label="SuperGross" value={fmt(current.superGross)} />
          <Row label="Yemək pulu" value={fmt(currentMeal)} />
        </Panel>
        <Panel title="Planlaşdırılan" highlight>
          <Row label="Net" value={fmt(plan.newNet)} />
          <Row label="Gross" value={fmt(plan.newGross)} />
          <Row label="SuperGross" value={fmt(plan.newSuperGross)} />
          <Row label="Yemək pulu" value={fmt(plan.newMeal)} />
        </Panel>
      </div>

      <div
        style={{
          marginTop: '1.25rem',
          padding: '0.875rem 1rem',
          borderRadius: 'var(--radius)',
          background: 'var(--color-primary-soft)',
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 600,
        }}
      >
        <span>Büdcə təsiri (illik gross Δ)</span>
        <span className="mono" style={{ color: deltaColor }}>
          {plan.deltaGrossAnnual >= 0 ? '+' : ''}
          {fmt(plan.deltaGrossAnnual)} ₼
        </span>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '0.5rem 0.75rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-background)',
  color: 'var(--color-foreground)',
  fontSize: 15,
};

function Panel({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 'var(--radius)',
        border: `1px solid ${highlight ? 'var(--color-primary)' : 'var(--color-border)'}`,
        padding: '1rem',
        background: highlight ? 'var(--color-primary-soft)' : 'var(--color-background)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'var(--color-muted-foreground)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: 'var(--color-muted-foreground)', fontSize: 14 }}>{label}</span>
      <span className="mono" style={{ fontSize: 14 }}>
        {value} ₼
      </span>
    </div>
  );
}
