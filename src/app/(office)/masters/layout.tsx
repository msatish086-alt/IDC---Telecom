import MasterTabs from '@/components/MasterTabs';
export default function L({ children }: { children: React.ReactNode }) {
  return (<><div className="top"><div><h1>Masters</h1><div className="sub">Users, sites with geo-fence, vendors and task templates — changes apply without code</div></div></div><MasterTabs /><div className="card">{children}</div></>);
}
