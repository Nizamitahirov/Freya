'use client';

/**
 * users/page.tsx — Rol və struktur idarəetməsi (SRS §3, §4).
 *
 * CompanyAdmin / HRAdmin istifadəçiyə rol verir və hansı strukturlar üzrə
 * işləyəcəyini təyin edir. Manager yalnız ona təyin olunmuş strukturların
 * əməkdaşlarını görür (row-level security, §3.2).
 */

import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { currentIdToken } from '@/lib/firebase/auth';
import {
  inviteMemberAction,
  listMembersAction,
  setMemberActiveAction,
} from '@/app/actions/company';
import { Button, Card, Input, StatusBadge } from '@/components/ui/primitives';
import type { Role } from '@/types';

const ALL_ROLES: Role[] = [
  'CompanyAdmin',
  'HRAdmin',
  'HRReviewer',
  'Finance',
  'Manager',
  'Viewer',
];

type MemberRow = {
  userId: string;
  email: string;
  roles: string[];
  structureIds: string[];
  active: boolean;
};

export default function UsersPage() {
  const { activeCompanyId, structures, role, mode } = useAppStore();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<Role[]>(['Manager']);
  const [structureIds, setStructureIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const isAdmin = role === 'CompanyAdmin' || role === 'HRAdmin' || role === 'PlatformOwner';

  const load = useCallback(async () => {
    if (mode !== 'live' || !isAdmin) return;
    try {
      const token = await currentIdToken();
      const res = await listMembersAction(token, { companyId: activeCompanyId });
      if (res.ok) setMembers(res.data);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta');
    }
  }, [activeCompanyId, isAdmin, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const token = await currentIdToken();
      const res = await inviteMemberAction(token, {
        companyId: activeCompanyId,
        email: email.trim(),
        roles,
        structureIds,
      });
      if (!res.ok) setError(res.error);
      else {
        setOk(`${email} üçün rol təyin olundu.`);
        setEmail('');
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta');
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (userId: string, active: boolean) => {
    const token = await currentIdToken();
    const res = await setMemberActiveAction(token, { companyId: activeCompanyId, userId, active });
    if (!res.ok) setError(res.error);
    await load();
  };

  const companyStructures = structures.filter((s) => s.companyId === activeCompanyId);
  const structureName = (id: string) => companyStructures.find((s) => s.id === id)?.name ?? id;

  if (mode !== 'live') {
    return (
      <Card title="İstifadəçilər">
        <p className="text-sm text-muted-foreground">
          Rol idarəetməsi Firebase rejimində işləyir (demo rejimdə üzvlük sənədləri yoxdur).
        </p>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card title="İstifadəçilər">
        <p className="text-sm text-muted-foreground">
          Bu bölmə yalnız CompanyAdmin və HRAdmin rolları üçündür.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">İstifadəçilər və rollar</h1>
        <p className="text-sm text-muted-foreground">
          İstifadəçi əvvəlcə qeydiyyatdan keçməlidir; sonra buradan ona rol və strukturlar təyin
          edilir.
        </p>
      </div>

      <Card title="Rol təyin et">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">İstifadəçinin e-poçtu</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ad@sirket.az"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Rollar</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(roles, r, setRoles)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition ${
                    roles.includes(r)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">
              Strukturlar{' '}
              <span className="text-xs text-muted-foreground font-normal">
                (Manager yalnız seçilənləri görür)
              </span>
            </label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {companyStructures.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(structureIds, s.id, setStructureIds)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition ${
                    structureIds.includes(s.id)
                      ? 'bg-primary-soft text-primary border-primary/40'
                      : 'bg-secondary text-muted-foreground border-border'
                  }`}
                >
                  {s.name}
                  <span className="opacity-60 ml-1">{s.type}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setStructureIds(
                  structureIds.length === companyStructures.length
                    ? []
                    : companyStructures.map((s) => s.id),
                )
              }
              className="text-xs text-primary font-semibold mt-2"
            >
              {structureIds.length === companyStructures.length ? 'Heç birini seçmə' : 'Hamısını seç'}
            </button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {ok && <p className="text-sm text-success">{ok}</p>}

          <Button type="submit" disabled={busy || !email || roles.length === 0}>
            {busy ? 'Saxlanılır…' : 'Rolu təyin et'}
          </Button>
        </form>
      </Card>

      <Card title={`Üzvlər (${members.length})`} className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-3">İstifadəçi</th>
                <th className="px-4 py-3">Rollar</th>
                <th className="px-4 py-3">Strukturlar</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                    Hələ üzv yoxdur.
                  </td>
                </tr>
              )}
              {members.map((m) => (
                <tr key={m.userId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-semibold">{m.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.roles.map((r) => (
                        <span
                          key={r}
                          className="text-xs px-2 py-0.5 rounded-full bg-primary-soft text-primary font-semibold"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {m.structureIds.length === 0
                      ? '—'
                      : m.structureIds.length > 3
                        ? `${m.structureIds.slice(0, 3).map(structureName).join(', ')} +${m.structureIds.length - 3}`
                        : m.structureIds.map(structureName).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.active ? 'approved' : 'rejected'} />
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant={m.active ? 'outline' : 'success'}
                      onClick={() => setActive(m.userId, !m.active)}
                    >
                      {m.active ? 'Deaktiv et' : 'Aktivləşdir'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
