import { requireStaffUser } from '@/server/auth/request';
import { LauncherClient } from '@/components/launcher-client';

export const dynamic = 'force-dynamic';

export default async function AllAppsLauncherPage() {
  const user = await requireStaffUser();
  const firstName = (user.full_name_en || '').split(' ')[0] || 'Shabib';
  return <LauncherClient firstName={firstName} />;
}
