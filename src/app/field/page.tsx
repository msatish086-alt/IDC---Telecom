import { requireUser } from '@/lib/auth';
import FieldApp from './FieldApp';
export const metadata = { title: 'IDC Field' };
export default async function FieldPage() {
  const u = await requireUser();
  return <FieldApp name={u.name} isField={u.role === 'FIELD'} />;
}
