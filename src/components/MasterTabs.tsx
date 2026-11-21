'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const T = [['/masters/users', 'Users'], ['/masters/sites', 'Sites'], ['/masters/vendors', 'Vendors'], ['/masters/templates', 'Task templates & TAT']];
export default function MasterTabs() {
  const p = usePathname();
  return <div className="tabs" role="tablist">{T.map(([h, l]) => <Link key={h} href={h} role="tab" aria-selected={p === h}><button className={p === h ? 'on' : ''} tabIndex={-1}>{l}</button></Link>)}</div>;
}
