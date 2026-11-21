'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: [string, string, string][] = [
  ['/', 'Command Centre', 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  ['/pos', 'Purchase Orders', 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6'],
  ['/tasks', 'Tasks & TAT', 'M4 12l5 5L20 6'],
  ['/field', 'Field App', 'M7 2h10v20H7zM11 18h2'],
  ['/approvals', 'Approvals', 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM9 12l2 2 4-4'],
  ['/alerts', 'Alerts & Messages', 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0'],
  ['/billing', 'WCC & Billing', 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6'],
  ['/masters/users', 'Masters', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3'],
];
export default function Nav({ badges }: { badges: Record<string, number> }) {
  const p = usePathname();
  const on = (h: string) => (h === '/' ? p === '/' : p.startsWith(h.split('/').slice(0, 2).join('/')));
  return (
    <div id="navlinks">
      {NAV.map(([h, l, ic]) => (
        <Link key={h} href={h} className={'nav' + (on(h) ? ' on' : '')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ic} /></svg>
          {l}
          {badges[h] ? <span className="bdg">{badges[h]}</span> : null}
        </Link>
      ))}
    </div>
  );
}
