'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { Select } from '@/components/ui/primitives';
import { signOutUser } from '@/lib/firebase/auth';
import { auth } from '@/lib/firebase/client';
import type { Role } from '@/types';

const nav = [
  ['/dashboard', 'Dashboard', '▨'],
  ['/planning', 'Planlaşdırma', '✎'],
  ['/review', 'Review (HR)', '☑'],
  ['/structure', 'Struktur', '⛬'],
  ['/grades', 'Grade & Band', '▤'],
  ['/market', 'Market', '◈'],
  ['/reports', 'Hesabatlar', '⤓'],
  ['/users', 'İstifadəçilər', '☺'],
  ['/settings', 'Tənzimləmələr', '⚙'],
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const mode = useAppStore((s) => s.mode);
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const availableRoles = useAppStore((s) => s.availableRoles);
  const companies = useAppStore((s) => s.companies);
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);
  const setActiveCompany = useAppStore((s) => s.setActiveCompany);
  const cycles = useAppStore((s) => s.cycles);
  const activeCycleId = useAppStore((s) => s.activeCycleId);
  const setActiveCycle = useAppStore((s) => s.setActiveCycle);
  const error = useAppStore((s) => s.error);
  const setError = useAppStore((s) => s.setError);
  const busy = useAppStore((s) => s.busy);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const companyCycles = cycles.filter((c) => c.companyId === activeCompanyId);
  const email = auth?.currentUser?.email ?? null;

  const signOut = async () => {
    await signOutUser();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-primary text-primary-foreground grid place-items-center font-extrabold shadow-glow">
              F
            </span>
            <span className="font-extrabold">Freya</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Compensation Planning</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(([href, label, icon]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <span className="w-4 text-center">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border text-xs text-muted-foreground">
          {mode === 'live' ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Firebase · canlı
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              Demo mode · seed data
            </span>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Şirkət</label>
            <Select
              value={activeCompanyId}
              onChange={(e) => setActiveCompany(e.target.value)}
              className="w-48"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {companyCycles.length > 0 && (
              <>
                <label className="text-xs text-muted-foreground ml-2">Dövr</label>
                <Select
                  value={activeCycleId}
                  onChange={(e) => setActiveCycle(e.target.value)}
                  className="w-64"
                >
                  {companyCycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </>
            )}
            {busy && <span className="text-xs text-muted-foreground">saxlanılır…</span>}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">
              {mode === 'live' ? 'Rol' : 'Rol (demo)'}
            </label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-40">
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <div
              className="w-9 h-9 rounded-full bg-primary-soft text-primary grid place-items-center font-bold"
              title={email ?? role}
            >
              {(email ?? role)[0]?.toUpperCase()}
            </div>
            {mode === 'live' && (
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Çıxış
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="bg-destructive/10 border-b border-destructive/30 px-6 py-2.5 flex items-center justify-between gap-4">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-destructive/70 hover:text-destructive shrink-0"
            >
              bağla ✕
            </button>
          </div>
        )}

        <main className="flex-1 p-6 overflow-x-hidden">
          <div className="mb-1 text-xs text-muted-foreground">
            {activeCompany?.name} · {activeCompany?.currency} · {activeCompany?.taxProfile.sector} ·{' '}
            {activeCompany?.taxProfile.year}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
