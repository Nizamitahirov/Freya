'use client';

/**
 * FirebaseGate — autentifikasiya qapısı + Firestore realtime sinxronu (SRS §3, §4, §13, §18).
 *
 * Axın:
 *   Firebase konfiqurasiya olunmayıb  → demo rejim (localStorage) ilə davam.
 *   İstifadəçi daxil olmayıb          → /login-ə yönləndir.
 *   Üzvlük yoxdur                     → onboarding (şirkət yarat).
 *   Üzvlük var                        → store `live` rejimə keçir, data Firestore-dan realtime axır.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { auth, isFirebaseReady } from '@/lib/firebase/client';
import { fetchCompanies, fetchMemberships, subscribeCompanyData } from '@/lib/firebase/db';
import { useAppStore } from '@/stores/appStore';
import { claimBootstrapAction } from '@/app/actions/company';
import type { Membership } from '@/types';
import Onboarding from './Onboarding';

type Phase = 'loading' | 'demo' | 'onboarding' | 'ready';

export default function FirebaseGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const goLive = useAppStore((s) => s.goLive);
  const goDemo = useAppStore((s) => s.goDemo);
  const hydrate = useAppStore((s) => s.hydrate);
  const setError = useAppStore((s) => s.setError);
  const activeCompanyId = useAppStore((s) => s.activeCompanyId);

  /** Üzvlükləri oxuyub store-u live rejimə keçirir. */
  const bootstrap = useCallback(
    async (u: User) => {
      let list = await fetchMemberships(u.uid);

      // İlk admin təyinatı: BOOTSTRAP_ADMIN_EMAILS siyahısındakı istifadəçi mövcud
      // şirkətə avtomatik bağlanır (SRS §4) — əks halda onboarding göstərilir.
      if (list.length === 0) {
        const claimed = await claimBootstrapAction(await u.getIdToken());
        if (claimed.ok) list = await fetchMemberships(u.uid);
      }

      setMemberships(list);
      if (list.length === 0) {
        setPhase('onboarding');
        return;
      }
      const companies = await fetchCompanies(list.map((m) => m.companyId));
      const persisted = useAppStore.getState().activeCompanyId;
      const chosen = list.find((m) => m.companyId === persisted) ?? list[0];
      goLive({
        userId: u.uid,
        companies,
        activeCompanyId: chosen.companyId,
        roles: chosen.roles,
        structureIds: chosen.structureIds,
      });
      setPhase('ready');
    },
    [goLive],
  );

  // 1) Auth vəziyyəti
  useEffect(() => {
    useAppStore.persist.rehydrate();

    if (!isFirebaseReady() || !auth) {
      goDemo();
      setPhase('demo');
      return;
    }

    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        router.replace('/login');
        return;
      }
      bootstrap(u).catch((err) => {
        setError(err instanceof Error ? err.message : 'Firestore oxunmadı.');
        setPhase('onboarding');
      });
    });
    return () => unsub();
  }, [bootstrap, goDemo, router, setError]);

  // 2) Aktiv şirkət dəyişdikdə üzvlüyü yenilə (rol + strukturlar)
  useEffect(() => {
    if (phase !== 'ready' || !user) return;
    const membership = memberships.find((m) => m.companyId === activeCompanyId);
    if (!membership) return;
    hydrate({ availableRoles: membership.roles, structureIds: membership.structureIds });
  }, [activeCompanyId, hydrate, memberships, phase, user]);

  // 3) Firestore realtime abunəsi
  useEffect(() => {
    if (phase !== 'ready' || !activeCompanyId) return;
    const membership = memberships.find((m) => m.companyId === activeCompanyId);
    if (!membership) return;

    unsubRef.current?.();
    unsubRef.current = subscribeCompanyData(
      {
        companyId: activeCompanyId,
        roles: membership.roles,
        structureIds: membership.structureIds,
      },
      {
        onStructures: (structures) => hydrate({ structures }),
        onGrades: (grades) => hydrate({ grades }),
        onEmployees: (employees) => hydrate({ employees }),
        onBudgets: (budgets) => hydrate({ budgets }),
        onCycles: (cycles) => {
          const current = useAppStore.getState().activeCycleId;
          const valid = cycles.some((c) => c.id === current);
          hydrate({ cycles, activeCycleId: valid ? current : (cycles[0]?.id ?? '') });
        },
        onPlanningItems: (planningItems) => hydrate({ planningItems }),
        onMarketData: (marketData) => hydrate({ marketData }),
        onError: (message) =>
          setError(
            `Firestore girişi rədd edildi: ${message}. Firestore rules deploy olunub və üzvlüyünüz aktivdirmi?`,
          ),
      },
    );

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [activeCompanyId, hydrate, memberships, phase, setError]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground text-sm">
        Yüklənir…
      </div>
    );
  }

  if (phase === 'onboarding' && user) {
    return (
      <Onboarding
        email={user.email}
        onDone={() => {
          setPhase('loading');
          bootstrap(user).catch((err) =>
            setError(err instanceof Error ? err.message : 'Şirkət yaradıldı, amma oxuna bilmədi.'),
          );
        }}
      />
    );
  }

  return <>{children}</>;
}
