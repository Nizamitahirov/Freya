'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInEmail, signUpEmail, signInGoogle } from '@/lib/firebase/auth';
import { auth, isFirebaseReady } from '@/lib/firebase/client';
import { Button, Card, Input } from '@/components/ui/primitives';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Artıq daxil olubsa birbaşa dashboard-a (kök səhifə də bura yönləndirir).
  useEffect(() => {
    if (!isFirebaseReady() || !auth) return;
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) router.replace('/dashboard');
    });
    return () => unsub();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signin') await signInEmail(email, password);
      else await signUpEmail(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta baş verdi');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    try {
      await signInGoogle();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xəta baş verdi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-6">
        <span className="inline-grid place-items-center w-11 h-11 rounded-xl bg-primary text-primary-foreground font-extrabold shadow-glow mb-3">
          F
        </span>
        <h1 className="text-2xl font-extrabold">Freya</h1>
        <p className="text-sm text-muted-foreground">Compensation Planning Tool</p>
      </div>

      <Card>
        <div className="flex gap-2 mb-4">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                mode === m ? 'bg-primary-soft text-primary' : 'text-muted-foreground'
              }`}
            >
              {m === 'signin' ? 'Daxil ol' : 'Qeydiyyat'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Input type="email" placeholder="E-poçt" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Şifrə" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === 'signin' ? 'Daxil ol' : 'Hesab yarat'}
          </Button>
        </form>

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">və ya</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
          Google ilə davam et
        </Button>
      </Card>

      <Link href="/dashboard" className="block text-center mt-4 text-sm text-primary font-semibold">
        Demo rejimi (Firebase olmadan) →
      </Link>
    </div>
  );
}
