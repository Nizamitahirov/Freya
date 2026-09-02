'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { money } from '@/lib/format';
import { compaRatio, bandPosition } from '@/lib/comp';
import { Card, Button, StatusBadge } from '@/components/ui/primitives';

type Row = { grade: string; p25: number; p50: number; p75: number; p90: number };

const TEMPLATE = `grade,p25,p50,p75,p90
G7,1200,1500,1900,2300
G8,2800,3400,4200,5000`;

export default function MarketPage() {
  const { employees, activeCompanyId } = useAppStore();
  const [csv, setCsv] = useState(TEMPLATE);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  const parse = () => {
    try {
      const lines = csv.trim().split(/\r?\n/);
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const idx = (k: string) => header.indexOf(k);
      const out: Row[] = lines.slice(1).map((line) => {
        const c = line.split(',');
        return {
          grade: c[idx('grade')].trim(),
          p25: Number(c[idx('p25')]),
          p50: Number(c[idx('p50')]),
          p75: Number(c[idx('p75')]),
          p90: Number(c[idx('p90')]),
        };
      });
      setRows(out);
      setError('');
    } catch {
      setError('CSV formatı xətalıdır. Şablona uyğun olduğundan əmin olun.');
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">Market (bazar) analizi</h1>
      <p className="text-sm text-muted-foreground">
        CSV/XLSX yüklə (Faza 2-də Firebase Storage + SheetJS). Aşağıda CSV yapışdırıb parse edə bilərsən.
      </p>

      <Card title="CSV upload (demo parse)">
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          className="w-full mono text-sm p-3 rounded-xl border border-border bg-background"
        />
        <div className="flex items-center gap-3 mt-3">
          <Button onClick={parse}>Parse et</Button>
          <span className="text-xs text-muted-foreground">Sahələr: grade, p25, p50, p75, p90</span>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card title="Market mövqeyi (median-ə görə compa-ratio)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-2 py-2">Grade</th>
                  <th className="px-2 py-2 text-right">P25</th>
                  <th className="px-2 py-2 text-right">P50</th>
                  <th className="px-2 py-2 text-right">P75</th>
                  <th className="px-2 py-2 text-right">P90</th>
                  <th className="px-2 py-2">Əməkdaşlar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const emps = employees.filter((e) => e.companyId === activeCompanyId && e.gradeId === r.grade);
                  return (
                    <tr key={r.grade} className="border-b border-border last:border-0">
                      <td className="px-2 py-2 font-medium">{r.grade}</td>
                      <td className="px-2 py-2 text-right mono">{money(r.p25)}</td>
                      <td className="px-2 py-2 text-right mono">{money(r.p50)}</td>
                      <td className="px-2 py-2 text-right mono">{money(r.p75)}</td>
                      <td className="px-2 py-2 text-right mono">{money(r.p90)}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          {emps.map((e) => {
                            const ratio = compaRatio(e.currentGross, r.p50);
                            return (
                              <span key={e.id} className="inline-flex items-center gap-1 text-xs">
                                {e.fullName} <StatusBadge status={bandPosition(ratio)} />
                                <span className="mono text-muted-foreground">{ratio}</span>
                              </span>
                            );
                          })}
                          {emps.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
