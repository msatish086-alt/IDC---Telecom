export const inr = (v: number | string | null | undefined) =>
  '₹' + Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const A = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const B = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number) => (n < 20 ? A[n] : B[Math.floor(n / 10)] + (n % 10 ? ' ' + A[n % 10] : ''));
const three = (n: number) => (n >= 100 ? A[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '');

/** Amount in words, Indian system (lakh / crore) — invoice format. */
export function amountInWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  let r = Math.floor(rounded); const p = Math.round((rounded - r) * 100); const out: string[] = [];
  const cr = Math.floor(r / 1e7); r %= 1e7; const lk = Math.floor(r / 1e5); r %= 1e5; const th = Math.floor(r / 1e3); r %= 1e3;
  if (cr) out.push((cr >= 100 ? three(cr) : two(cr)) + ' Crore');
  if (lk) out.push(two(lk) + ' Lakh');
  if (th) out.push(two(th) + ' Thousand');
  if (r) out.push(three(r));
  let s = 'Rupees ' + (out.join(' ') || 'Zero');
  if (p) s += ' and ' + two(p) + ' Paise';
  return s + ' Only';
}

/** GST split for an intra-state (UP → UP) service invoice: CGST 9% + SGST 9%. */
export function gstSplit(taxable: number) {
  const cgst = Math.round(taxable * 0.09 * 100) / 100;
  const sgst = Math.round(taxable * 0.09 * 100) / 100;
  return { cgst, sgst, total: Math.round((taxable + cgst + sgst) * 100) / 100 };
}
