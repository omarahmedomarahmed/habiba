import { redirect } from 'next/navigation';

// Therapist domain root. Authenticated users are sent to the dashboard;
// unauthenticated users are bounced to /login by middleware before this runs.
export default function RootPage() {
  redirect('/dashboard');
}
