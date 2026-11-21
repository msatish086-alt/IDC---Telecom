import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { invoices, poLines, purchaseOrders, sites } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { fmt } from '@/lib/dates';
import { inr } from '@/lib/money';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [r] = await db.select({ i: invoices, po: purchaseOrders, site: sites }).from(invoices).innerJoin(purchaseOrders, eq(invoices.poId, purchaseOrders.id))
    .leftJoin(sites, eq(purchaseOrders.siteRef, sites.id)).where(eq(invoices.id, id));
  if (!r) notFound();
  const lines = await db.select().from(poLines).where(eq(poLines.poId, r.po.id)).orderBy(asc(poLines.lineNo));
  const { i, po, site } = r;
  const approved = po.approvedValue != null;
  return (
    <div className="inv-page">
      <div className="row noprint" style={{ justifyContent: 'space-between', marginBottom: 12 }}><Link href="/billing">← WCC & Billing</Link><span className="small muted">Use the browser's Print → Save as PDF</span></div>
      <div className="inv">
        <div className="row" style={{ justifyContent: 'space-between' }}><div><b style={{ fontSize: 15 }}>IDC (Infini Di Carriera Tech Pvt Ltd)</b><div>Lucknow, Uttar Pradesh · GSTIN [IDC GSTIN]</div></div>
          <div style={{ textAlign: 'right' }}><b>TAX INVOICE</b><div>No. {i.number}</div><div>Date {fmt(i.date)}</div></div></div>
        <div style={{ margin: '12px 0' }}><b>Bill to:</b> Indus Towers Ltd — {po.circle ?? 'UP'} · GSTIN [Indus GSTIN]<br />
          <b>PO:</b> {po.poNumber} · <b>Site:</b> {site?.siteId} {site?.name}{po.wccNo ? <> · <b>WCC:</b> {po.wccNo}</> : null}</div>
        <table><thead><tr><th>#</th><th>Description</th><th>SAC</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>{approved ? <tr><td>1</td><td>Work as per PO {po.poNumber} — Indus approved value</td><td>995461</td><td>1</td><td>{inr(i.taxable)}</td><td>{inr(i.taxable)}</td></tr>
            : lines.map((l) => <tr key={l.id}><td>{l.lineNo}</td><td>{l.description}</td><td>995461</td><td>{Number(l.qty)}</td><td>{inr(l.rate)}</td><td>{inr(l.amount)}</td></tr>)}
            <tr><td colSpan={5} style={{ textAlign: 'right' }}>Taxable value</td><td>{inr(i.taxable)}</td></tr>
            <tr><td colSpan={5} style={{ textAlign: 'right' }}>CGST 9%</td><td>{inr(i.cgst)}</td></tr>
            <tr><td colSpan={5} style={{ textAlign: 'right' }}>SGST 9%</td><td>{inr(i.sgst)}</td></tr>
            <tr><td colSpan={5} style={{ textAlign: 'right' }}><b>Total</b></td><td><b>{inr(i.total)}</b></td></tr></tbody></table>
        <div style={{ marginTop: 10 }}><b>Amount in words:</b> {i.amountWords}</div>
        <div className="muted" style={{ marginTop: 8 }}>Final layout, SAC code and GSTINs as per the Invoice Format sheet (Finance to confirm).</div>
      </div>
    </div>
  );
}
