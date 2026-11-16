import { redirect } from 'next/navigation';
import { defaultHomeForRole, getCurrentUser } from '@/server/auth/request';

export default async function RootRedirectPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  redirect(defaultHomeForRole(user.role));
}
