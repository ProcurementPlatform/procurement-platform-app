import { Invoice, InvoiceDocument, InvoiceLineItem } from '../models/Invoice';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3, generatePresignedDownloadUrl } from '@procurement/common';

const generateInvoiceNumber = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${m}-${rand}`;
};

const numberToWords = (amount: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };

  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  let result = 'Rupees ' + convert(intPart);
  if (decPart > 0) result += ' and ' + convert(decPart) + ' Paise';
  return result + ' Only';
};

const computeTotals = (data: Partial<InvoiceDocument>) => {
  const items: InvoiceLineItem[] = data.lineItems || [];

  let subTotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

  items.forEach(item => {
    const taxable = item.taxableAmount ?? (item.quantity * item.rate * (1 - (item.discount || 0) / 100));
    item.taxableAmount = Math.round(taxable * 100) / 100;

    const gst = item.gstPercentage || 0;
    const halfGst = gst / 2;

    // Determine CGST/SGST vs IGST based on place of supply flag
    if (data.placeOfSupply && data.placeOfSupply !== 'Inter-State') {
      item.cgstAmount = Math.round(item.taxableAmount * (halfGst / 100) * 100) / 100;
      item.sgstAmount = Math.round(item.taxableAmount * (halfGst / 100) * 100) / 100;
      item.igstAmount = 0;
      totalCgst += item.cgstAmount;
      totalSgst += item.sgstAmount;
    } else {
      item.cgstAmount = 0;
      item.sgstAmount = 0;
      item.igstAmount = Math.round(item.taxableAmount * (gst / 100) * 100) / 100;
      totalIgst += item.igstAmount;
    }

    item.totalAmount = Math.round((item.taxableAmount + item.cgstAmount + item.sgstAmount + item.igstAmount) * 100) / 100;
    subTotal += item.taxableAmount;
  });

  const totalGst = Math.round((totalCgst + totalSgst + totalIgst) * 100) / 100;
  const grossAmount = Math.round((subTotal + totalGst) * 100) / 100;
  const tdsPercentage = data.tdsPercentage || 0;
  const tdsAmount = Math.round(subTotal * (tdsPercentage / 100) * 100) / 100;
  const companyReceivable = grossAmount;
  const vendorPayable = Math.round((grossAmount - tdsAmount) * 100) / 100;

  return {
    lineItems: items,
    subTotal: Math.round(subTotal * 100) / 100,
    totalCgst: Math.round(totalCgst * 100) / 100,
    totalSgst: Math.round(totalSgst * 100) / 100,
    totalIgst: Math.round(totalIgst * 100) / 100,
    totalGst,
    grossAmount,
    tdsAmount,
    tdsPercentage,
    companyReceivable,
    vendorPayable,
    totalAmount: grossAmount,
    amount: subTotal,
    tax: totalGst,
    amountInWords: numberToWords(grossAmount),
  };
};

export class InvoiceService {
  async findAll(query: Record<string, any> = {}, skip = 0, limit = 20) {
    let scanReq = Invoice.scan();

    if (query.status) scanReq = scanReq.where('status').eq(query.status);
    if (query.invoiceType) scanReq = scanReq.where('invoiceType').eq(query.invoiceType);

    const allInvoices = await scanReq.exec();

    let filtered = [...allInvoices];
    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter((i: any) =>
        i.invoiceNumber?.toLowerCase().includes(search) ||
        i.partyName?.toLowerCase().includes(search)
      );
    }

    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const invoices = filtered.slice(skip, skip + limit);
    return { invoices, total: filtered.length };
  }

  async findById(id: string) {
    const invoice = await Invoice.get(id);
    if (!invoice) throw new Error('Invoice not found');
    return invoice;
  }

  async create(data: Partial<InvoiceDocument>, userId: string) {
    const invoiceNumber = generateInvoiceNumber();
    const computed = computeTotals(data);

    return await Invoice.create({
      ...data,
      ...computed,
      _id: uuidv4(),
      invoiceNumber,
      createdBy: userId,
    });
  }

  async update(id: string, data: Partial<InvoiceDocument>) {
    const invoice = await Invoice.get(id);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'paid') throw new Error('Cannot update a paid invoice');

    // Unlike Invoice.create(), Invoice.update() does not auto-coerce date
    // strings (e.g. from a date <input>) into Date instances, so do it here.
    const normalized: Partial<InvoiceDocument> = { ...data };
    if (normalized.issueDate) normalized.issueDate = new Date(normalized.issueDate as any);
    if (normalized.dueDate) normalized.dueDate = new Date(normalized.dueDate as any);

    const computed = normalized.lineItems ? computeTotals({ ...invoice, ...normalized }) : {};
    return await Invoice.update({ _id: id }, { ...normalized, ...computed });
  }

  async delete(id: string) {
    const invoice = await Invoice.get(id);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'paid') throw new Error('Cannot delete a paid invoice');
    await Invoice.delete(id);
  }

  async approve(id: string, userId: string) {
    const invoice = await Invoice.get(id);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'pending') throw new Error('Only pending invoices can be approved');
    return await Invoice.update({ _id: id }, { status: 'approved', approvedBy: userId, approvedAt: new Date() });
  }

  async markAsPaid(id: string, paymentMethod: string) {
    const invoice = await Invoice.get(id);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'approved') throw new Error('Invoice must be approved before payment');
    return await Invoice.update({ _id: id }, {
      status: 'paid',
      paymentDate: new Date(),
      paymentMethod,
    });
  }

  async generatePdf(id: string) {
    const invoice = await Invoice.get(id);
    if (!invoice) throw new Error('Invoice not found');

    try {
      // Dynamically import puppeteer (optional dependency)
      const puppeteer = await import('puppeteer').catch(() => null);
      if (!puppeteer) {
        // If puppeteer not installed, return a data URL placeholder
        return { url: null, fileName: `${invoice.invoiceNumber}.pdf`, message: 'PDF generation requires puppeteer' };
      }

      const html = buildInvoiceHtml(invoice as any);
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
      await browser.close();

      const key = `invoices/${id}/${invoice.invoiceNumber}.pdf`;
      let url: string | null = null;

      try {
        await uploadToS3(Buffer.from(pdfBuffer), key, 'application/pdf');
        await Invoice.update({ _id: id }, { pdfUrl: key, pdfKey: key });
        url = generatePresignedDownloadUrl(key, 3600);
      } catch (_s3Err) {
        // S3 not configured locally — return buffer as base64
        url = `data:application/pdf;base64,${Buffer.from(pdfBuffer).toString('base64')}`;
      }

      return { url, fileName: `${invoice.invoiceNumber}.pdf` };
    } catch (err: any) {
      throw new Error(`PDF generation failed: ${err.message}`);
    }
  }

  async getStats() {
    const allInvoices = await Invoice.scan().exec();
    const now = new Date();

    let totalGrossAmount = 0, totalGst = 0, totalTds = 0, totalReceivable = 0, totalPayable = 0;
    const statusMap: Record<string, { count: number; totalAmount: number }> = {};

    allInvoices.forEach((i: any) => {
      const s = i.status || 'unknown';
      if (!statusMap[s]) statusMap[s] = { count: 0, totalAmount: 0 };
      statusMap[s].count++;
      statusMap[s].totalAmount += i.grossAmount || i.totalAmount || 0;

      totalGrossAmount += i.grossAmount || i.totalAmount || 0;
      totalGst += i.totalGst || i.tax || 0;
      totalTds += i.tdsAmount || 0;
      totalReceivable += i.companyReceivable || i.totalAmount || 0;
      totalPayable += i.vendorPayable || i.totalAmount || 0;

      // Auto-mark overdue
      if (i.status === 'pending' || i.status === 'approved') {
        const due = new Date(i.dueDate);
        if (due < now) {
          Invoice.update({ _id: i._id }, { status: 'overdue' }).catch(() => {});
        }
      }
    });

    return {
      total: allInvoices.length,
      byStatus: Object.entries(statusMap).map(([status, v]) => ({ status, ...v })),
      summary: {
        totalGrossAmount: Math.round(totalGrossAmount * 100) / 100,
        totalGst: Math.round(totalGst * 100) / 100,
        totalTds: Math.round(totalTds * 100) / 100,
        totalReceivable: Math.round(totalReceivable * 100) / 100,
        totalPayable: Math.round(totalPayable * 100) / 100,
      },
    };
  }
}

// ─── PDF HTML Template ─────────────────────────────────────────────────────────
function buildInvoiceHtml(invoice: any): string {
  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const lineRows = (invoice.lineItems || []).map((item: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.description || ''}</td>
      <td>${item.hsnSacCode || ''}</td>
      <td>${item.quantity || ''}</td>
      <td>${item.unit || 'Nos'}</td>
      <td>${fmt(item.rate)}</td>
      <td>${item.discount ? item.discount + '%' : '—'}</td>
      <td>${fmt(item.taxableAmount)}</td>
      <td>${item.gstPercentage || 0}%</td>
      <td>${fmt((item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0))}</td>
      <td>${fmt(item.totalAmount)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size:12px; color:#1a1a2e; background:#fff; }
  .page { padding:20px; max-width:800px; margin:0 auto; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1a1a2e; padding-bottom:16px; margin-bottom:16px; }
  .company-name { font-size:24px; font-weight:800; color:#1a1a2e; letter-spacing:-0.5px; }
  .invoice-title { font-size:20px; font-weight:700; color:#1a1a2e; text-align:right; }
  .invoice-meta { text-align:right; font-size:11px; color:#555; margin-top:4px; }
  .badge { display:inline-block; background:#1a1a2e; color:#fff; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600; margin-top:4px; text-transform:uppercase; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
  .party-box { background:#f8f9fa; border-radius:8px; padding:12px; }
  .party-label { font-size:10px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
  .party-name { font-size:14px; font-weight:700; color:#1a1a2e; }
  .party-detail { font-size:11px; color:#555; margin-top:2px; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; }
  th { background:#1a1a2e; color:#fff; padding:8px 6px; text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; }
  td { padding:7px 6px; border-bottom:1px solid #e8e8e8; font-size:11px; }
  tr:nth-child(even) td { background:#f8f9fa; }
  .summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
  .tax-table { background:#f8f9fa; border-radius:8px; padding:12px; }
  .tax-table table th { background:#e0e0e8; color:#1a1a2e; }
  .totals { background:#1a1a2e; color:#fff; border-radius:8px; padding:12px; }
  .total-row { display:flex; justify-content:space-between; padding:4px 0; font-size:12px; }
  .total-row.grand { font-size:16px; font-weight:800; border-top:1px solid rgba(255,255,255,0.3); margin-top:8px; padding-top:8px; }
  .amount-words { background:#fff8e1; border:1px solid #ffc107; border-radius:6px; padding:10px; margin-bottom:16px; font-size:11px; font-style:italic; color:#555; }
  .bank-section { background:#f0f4ff; border-radius:8px; padding:12px; margin-bottom:16px; }
  .bank-section h4 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:8px; }
  .bank-detail { font-size:11px; color:#1a1a2e; margin-bottom:2px; }
  .signature-section { display:flex; justify-content:space-between; align-items:flex-end; border-top:2px solid #1a1a2e; padding-top:12px; }
  .terms { font-size:10px; color:#888; max-width:60%; }
  .signature { text-align:right; }
  .sig-line { width:120px; border-bottom:1px solid #333; margin-bottom:6px; height:30px; }
  .sig-label { font-size:10px; color:#888; }
  .footer { text-align:center; font-size:10px; color:#aaa; margin-top:16px; border-top:1px solid #eee; padding-top:8px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="company-name">ProcureFlow</div>
      <div style="font-size:11px;color:#555;margin-top:4px;">Procurement Platform</div>
    </div>
    <div>
      <div class="invoice-title">TAX INVOICE</div>
      <div class="invoice-meta"># ${invoice.invoiceNumber || '—'}</div>
      <div class="badge">${(invoice.invoiceType || 'VENDOR_INVOICE').replace('_', ' ')}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party-box">
      <div class="party-label">Bill From</div>
      <div class="party-name">${invoice.partyName || '—'}</div>
      ${invoice.partyGstin ? `<div class="party-detail"><b>GSTIN:</b> ${invoice.partyGstin}</div>` : ''}
      ${invoice.partyPan ? `<div class="party-detail"><b>PAN:</b> ${invoice.partyPan}</div>` : ''}
      ${invoice.partyAddress ? `<div class="party-detail">${invoice.partyAddress}</div>` : ''}
    </div>
    <div class="party-box" style="background:#fff;border:1px solid #e0e0e8;">
      <div class="party-label">Invoice Details</div>
      <div class="party-detail"><b>Issue Date:</b> ${fmtDate(invoice.issueDate)}</div>
      <div class="party-detail"><b>Due Date:</b> ${fmtDate(invoice.dueDate)}</div>
      ${invoice.poNumber ? `<div class="party-detail"><b>PO Ref:</b> ${invoice.poNumber}</div>` : ''}
      ${invoice.placeOfSupply ? `<div class="party-detail"><b>Place of Supply:</b> ${invoice.placeOfSupply}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Unit</th>
        <th>Rate</th><th>Disc.</th><th>Taxable Amt</th><th>GST%</th><th>GST Amt</th><th>Total</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="summary-grid">
    <div class="tax-table">
      <table>
        <thead><tr><th>Tax</th><th>Taxable</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>
          ${invoice.totalCgst > 0 ? `<tr><td>CGST</td><td>${fmt(invoice.subTotal)}</td><td>${(invoice.gstPercentage || 18) / 2}%</td><td>${fmt(invoice.totalCgst)}</td></tr>` : ''}
          ${invoice.totalSgst > 0 ? `<tr><td>SGST</td><td>${fmt(invoice.subTotal)}</td><td>${(invoice.gstPercentage || 18) / 2}%</td><td>${fmt(invoice.totalSgst)}</td></tr>` : ''}
          ${invoice.totalIgst > 0 ? `<tr><td>IGST</td><td>${fmt(invoice.subTotal)}</td><td>${invoice.gstPercentage || 18}%</td><td>${fmt(invoice.totalIgst)}</td></tr>` : ''}
          ${invoice.tdsAmount > 0 ? `<tr><td>TDS Deduction</td><td colspan="2">${invoice.tdsPercentage || 0}%</td><td style="color:#e53e3e">(${fmt(invoice.tdsAmount)})</td></tr>` : ''}
        </tbody>
      </table>
    </div>

    <div class="totals">
      <div class="total-row"><span>Sub Total</span><span>${fmt(invoice.subTotal)}</span></div>
      <div class="total-row"><span>Total GST</span><span>${fmt(invoice.totalGst)}</span></div>
      ${invoice.tdsAmount > 0 ? `<div class="total-row" style="color:#fca5a5;"><span>TDS Deducted</span><span>(${fmt(invoice.tdsAmount)})</span></div>` : ''}
      <div class="total-row grand"><span>Net Amount</span><span>${fmt(invoice.vendorPayable || invoice.grossAmount)}</span></div>
    </div>
  </div>

  ${invoice.amountInWords ? `<div class="amount-words">Amount in Words: <b>${invoice.amountInWords}</b></div>` : ''}

  ${(invoice.bankName || invoice.accountNumber) ? `
  <div class="bank-section">
    <h4>Bank Details</h4>
    ${invoice.accountHolder ? `<div class="bank-detail"><b>Account Holder:</b> ${invoice.accountHolder}</div>` : ''}
    ${invoice.bankName ? `<div class="bank-detail"><b>Bank:</b> ${invoice.bankName}</div>` : ''}
    ${invoice.accountNumber ? `<div class="bank-detail"><b>Account No.:</b> ${invoice.accountNumber}</div>` : ''}
    ${invoice.ifscCode ? `<div class="bank-detail"><b>IFSC Code:</b> ${invoice.ifscCode}</div>` : ''}
    ${invoice.upiId ? `<div class="bank-detail"><b>UPI ID:</b> ${invoice.upiId}</div>` : ''}
  </div>` : ''}

  <div class="signature-section">
    <div class="terms">
      ${invoice.termsAndConditions || '<b>Terms:</b> Payment is due within the period specified. Please quote the invoice number in all correspondence.'}
    </div>
    <div class="signature">
      <div class="sig-line"></div>
      <div class="sig-label">Authorized Signatory</div>
    </div>
  </div>

  <div class="footer">This is a computer-generated invoice. No physical signature is required. | ProcureFlow</div>
</div>
</body></html>`;
}

export default new InvoiceService();
