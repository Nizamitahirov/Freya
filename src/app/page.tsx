import { redirect } from 'next/navigation';

/** Landing səhifəsi yoxdur — kök birbaşa girişə yönləndirir (auth → dashboard). */
export default function RootPage() {
  redirect('/login');
}
