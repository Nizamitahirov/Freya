import AppShell from '@/components/app-shell/AppShell';
import FirebaseGate from '@/components/providers/FirebaseGate';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseGate>
      <AppShell>{children}</AppShell>
    </FirebaseGate>
  );
}
