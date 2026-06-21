import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { invoiceApi, vendorApi, customerApi } from '../../services/endpoints';
import { formatCurrency } from '../../lib/utils';
import { X, Plus, Trash2, IndianRupee, AlertCircle } from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh',
  'Chandigarh','Puducherry','Inter-State',
];

const GST_RATES = [0, 5, 12, 18, 28];

const emptyLineItem = () => ({
  description: '',
  hsnSacCode: '',
  quantity: 1,
  unit: 'Nos',
  rate: 0,
  discount: 0,
  gstPercentage: 18,
  taxableAmount: 0,
  cgstAmount: 0,
  sgstAmount: 0,
  igstAmount: 0,
  totalAmount: 0,
});

const calcItem = (item: any, isInterState: boolean) => {
  const taxable = item.quantity * item.rate * (1 - (item.discount || 0) / 100);
  const gstRate = item.gstPercentage || 0;
  let cgst = 0, sgst = 0, igst = 0;
  if (isInterState) {
    igst = taxable * (gstRate / 100);
  } else {
    cgst = taxable * (gstRate / 2 / 100);
    sgst = taxable * (gstRate / 2 / 100);
  }
  const total = taxable + cgst + sgst + igst;
  return {
    ...item,
    taxableAmount: Math.round(taxable * 100) / 100,
    cgstAmount: Math.round(cgst * 100) / 100,
    sgstAmount: Math.round(sgst * 100) / 100,
    igstAmount: Math.round(igst * 100) / 100,
    totalAmount: Math.round(total * 100) / 100,
  };
};

interface InvoiceFormProps {
  invoice?: any;
  onClose: () => void;
  onSaved: () => void;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoice, onClose, onSaved }) => {
  const isEdit = !!invoice;
  const [form, setForm] = useState({
    invoiceType: invoice?.invoiceType || 'VENDOR_INVOICE',
    vendorId: invoice?.vendorId || invoice?.vendor || '',
    customerId: invoice?.customerId || '',
    partyName: invoice?.partyName || '',
    partyGstin: invoice?.partyGstin || '',
    partyPan: invoice?.partyPan || '',
    partyAddress: invoice?.partyAddress || '',
    issueDate: invoice?.issueDate ? invoice.issueDate.split('T')[0] : new Date().toISOString().split('T')[0],
    dueDate: invoice?.dueDate ? invoice.dueDate.split('T')[0] : '',
    poNumber: invoice?.poNumber || '',
    placeOfSupply: invoice?.placeOfSupply || 'Intra-State',
    tdsPercentage: invoice?.tdsPercentage || 0,
    bankName: invoice?.bankName || '',
    accountNumber: invoice?.accountNumber || '',
    ifscCode: invoice?.ifscCode || '',
    accountHolder: invoice?.accountHolder || '',
    upiId: invoice?.upiId || '',
    description: invoice?.description || '',
    notes: invoice?.notes || '',
    termsAndConditions: invoice?.termsAndConditions || 'Payment is due within the specified period. Please quote the invoice number in all correspondence.',
  });

  const [lineItems, setLineItems] = useState<any[]>(
    invoice?.lineItems?.length > 0 ? invoice.lineItems : [emptyLineItem()]
  );
  const [error, setError] = useState('');

  const isInterState = form.placeOfSupply === 'Inter-State';

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: () => vendorApi.getAll({ limit: 100, status: 'active' }),
    enabled: form.invoiceType === 'VENDOR_INVOICE',
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => customerApi.getAll({ limit: 100, status: 'active' }),
    enabled: form.invoiceType === 'CUSTOMER_INVOICE',
  });

  const vendors = vendorsData?.items || [];
  const customers = customersData?.items || [];

  // Update party details when vendor/customer selected
  useEffect(() => {
    if (form.invoiceType === 'VENDOR_INVOICE' && form.vendorId) {
      const v = vendors.find((v: any) => v._id === form.vendorId);
      if (v) {
        setForm(f => ({
          ...f,
          partyName: v.vendorName,
          partyGstin: v.taxId || '',
          partyAddress: v.address ? `${v.address.street}, ${v.address.city}, ${v.address.state}` : '',
        }));
      }
    }
  }, [form.vendorId, vendors]);

  useEffect(() => {
    if (form.invoiceType === 'CUSTOMER_INVOICE' && form.customerId) {
      const c = customers.find((c: any) => c._id === form.customerId);
      if (c) {
        setForm(f => ({
          ...f,
          partyName: c.companyName,
          partyGstin: c.gstin || '',
          partyPan: c.pan || '',
          partyAddress: c.address ? `${c.address.street}, ${c.address.city}, ${c.address.state}` : '',
        }));
      }
    }
  }, [form.customerId, customers]);

  const recalcItems = (items: any[]) => items.map(item => calcItem(item, isInterState));

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[idx] = calcItem({ ...updated[idx], [field]: value }, isInterState);
    setLineItems(updated);
  };

  const addItem = () => setLineItems([...lineItems, emptyLineItem()]);
  const removeItem = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx));

  // Totals
  const subTotal = lineItems.reduce((s, i) => s + (i.taxableAmount || 0), 0);
  const totalCgst = lineItems.reduce((s, i) => s + (i.cgstAmount || 0), 0);
  const totalSgst = lineItems.reduce((s, i) => s + (i.sgstAmount || 0), 0);
  const totalIgst = lineItems.reduce((s, i) => s + (i.igstAmount || 0), 0);
  const totalGst = totalCgst + totalSgst + totalIgst;
  const grossAmount = subTotal + totalGst;
  const tdsAmount = subTotal * ((form.tdsPercentage as number) / 100);
  const vendorPayable = grossAmount - tdsAmount;

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit ? invoiceApi.update(invoice._id, data) : invoiceApi.create(data),
    onSuccess: onSaved,
    onError: (err: any) => setError(err.response?.data?.message || err.message || 'Failed to save invoice'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.dueDate) { setError('Due date is required'); return; }
    if (!form.partyName) { setError('Party name is required'); return; }
    if (lineItems.length === 0) { setError('Add at least one line item'); return; }
    if (lineItems.some(i => !i.description || i.rate <= 0)) { setError('All line items need a description and rate'); return; }

    mutation.mutate({
      ...form,
      lineItems: recalcItems(lineItems),
      tdsPercentage: Number(form.tdsPercentage),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0d0d14] border border-white/[0.08] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div>
            <h2 className="text-xl font-semibold text-white">{isEdit ? 'Edit Invoice' : 'Create New Invoice'}</h2>
            <p className="text-sm text-neutral-400 mt-0.5">Fill in the details below to generate a professional invoice</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Section 1: Invoice Type & Party */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest mb-4">Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">Invoice Type *</label>
                <select value={form.invoiceType} onChange={e => setForm({ ...form, invoiceType: e.target.value })} className="input-field">
                  <option value="VENDOR_INVOICE" className="bg-[#0d0d14]">Vendor Invoice (Payable)</option>
                  <option value="CUSTOMER_INVOICE" className="bg-[#0d0d14]">Customer Invoice (Receivable)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">
                  {form.invoiceType === 'VENDOR_INVOICE' ? 'Vendor *' : 'Customer *'}
                </label>
                {form.invoiceType === 'VENDOR_INVOICE' ? (
                  <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="input-field">
                    <option value="" className="bg-[#0d0d14]">Select vendor (or type manually below)</option>
                    {vendors.map((v: any) => <option key={v._id} value={v._id} className="bg-[#0d0d14]">{v.vendorName}</option>)}
                  </select>
                ) : (
                  <select value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} className="input-field">
                    <option value="" className="bg-[#0d0d14]">Select customer (or type manually below)</option>
                    {customers.map((c: any) => <option key={c._id} value={c._id} className="bg-[#0d0d14]">{c.companyName}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">Party Name *</label>
                <input value={form.partyName} onChange={e => setForm({ ...form, partyName: e.target.value })} required className="input-field" placeholder="Company or individual name" />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">GSTIN</label>
                <input value={form.partyGstin} onChange={e => setForm({ ...form, partyGstin: e.target.value })} className="input-field" placeholder="22AAAAA0000A1Z5" maxLength={15} />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">PAN</label>
                <input value={form.partyPan} onChange={e => setForm({ ...form, partyPan: e.target.value })} className="input-field" placeholder="AAAAA0000A" maxLength={10} />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">Address</label>
                <input value={form.partyAddress} onChange={e => setForm({ ...form, partyAddress: e.target.value })} className="input-field" placeholder="Street, City, State" />
              </div>
            </div>
          </div>

          {/* Section 2: Dates & Reference */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest mb-4">Dates & References</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">Issue Date *</label>
                <input type="date" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })} required className="input-field" />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">Due Date *</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} required className="input-field" />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">PO Number</label>
                <input value={form.poNumber} onChange={e => setForm({ ...form, poNumber: e.target.value })} className="input-field" placeholder="PO-2024-001" />
              </div>
              <div>
                <label className="block text-sm text-neutral-300 mb-1.5">Place of Supply</label>
                <select value={form.placeOfSupply} onChange={e => {
                  setForm({ ...form, placeOfSupply: e.target.value });
                  setLineItems(lineItems.map(i => calcItem(i, e.target.value === 'Inter-State')));
                }} className="input-field">
                  {INDIAN_STATES.map(s => <option key={s} value={s} className="bg-[#0d0d14]">{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest">Line Items</h3>
              <button type="button" onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                <Plus size={14} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs font-semibold text-neutral-500 pb-2 pr-2 min-w-[200px]">Description *</th>
                    <th className="text-left text-xs font-semibold text-neutral-500 pb-2 pr-2 w-24">HSN/SAC</th>
                    <th className="text-left text-xs font-semibold text-neutral-500 pb-2 pr-2 w-16">Qty *</th>
                    <th className="text-left text-xs font-semibold text-neutral-500 pb-2 pr-2 w-24">Unit</th>
                    <th className="text-left text-xs font-semibold text-neutral-500 pb-2 pr-2 w-24">Rate *</th>
                    <th className="text-left text-xs font-semibold text-neutral-500 pb-2 pr-2 w-16">Disc%</th>
                    <th className="text-left text-xs font-semibold text-neutral-500 pb-2 pr-2 w-20">GST%</th>
                    <th className="text-right text-xs font-semibold text-neutral-500 pb-2 pr-2 w-24">Taxable</th>
                    <th className="text-right text-xs font-semibold text-neutral-500 pb-2 pr-2 w-24">{isInterState ? 'IGST' : 'CGST+SGST'}</th>
                    <th className="text-right text-xs font-semibold text-neutral-500 pb-2 w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {lineItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-white/[0.03]">
                      <td className="py-2 pr-2">
                        <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                          className="input-field text-xs py-1.5" placeholder="Service / product description" />
                      </td>
                      <td className="py-2 pr-2">
                        <input value={item.hsnSacCode || ''} onChange={e => updateItem(idx, 'hsnSacCode', e.target.value)}
                          className="input-field text-xs py-1.5" placeholder="9983" />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min={0} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="input-field text-xs py-1.5" />
                      </td>
                      <td className="py-2 pr-2">
                        <select value={item.unit || 'Nos'} onChange={e => updateItem(idx, 'unit', e.target.value)} className="input-field text-xs py-1.5">
                          {['Nos', 'Hrs', 'Days', 'Months', 'Kg', 'L', 'Pcs', 'Sets'].map(u => (
                            <option key={u} value={u} className="bg-[#0d0d14]">{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min={0} step={0.01} value={item.rate} onChange={e => updateItem(idx, 'rate', Number(e.target.value))}
                          className="input-field text-xs py-1.5" />
                      </td>
                      <td className="py-2 pr-2">
                        <input type="number" min={0} max={100} value={item.discount || 0} onChange={e => updateItem(idx, 'discount', Number(e.target.value))}
                          className="input-field text-xs py-1.5" />
                      </td>
                      <td className="py-2 pr-2">
                        <select value={item.gstPercentage} onChange={e => updateItem(idx, 'gstPercentage', Number(e.target.value))} className="input-field text-xs py-1.5">
                          {GST_RATES.map(r => <option key={r} value={r} className="bg-[#0d0d14]">{r}%</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-right text-xs text-neutral-300">{formatCurrency(item.taxableAmount)}</td>
                      <td className="py-2 pr-2 text-right text-xs text-cyan-400">
                        {isInterState ? formatCurrency(item.igstAmount) : formatCurrency((item.cgstAmount || 0) + (item.sgstAmount || 0))}
                      </td>
                      <td className="py-2 text-right text-xs font-semibold text-white">{formatCurrency(item.totalAmount)}</td>
                      <td className="py-2 pl-2">
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="p-1 hover:text-red-400 text-neutral-600 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Tax Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest mb-4">TDS</h3>
              <div className="flex items-center gap-3">
                <label className="text-sm text-neutral-400">TDS %</label>
                <select value={form.tdsPercentage} onChange={e => setForm({ ...form, tdsPercentage: Number(e.target.value) })}
                  className="input-field w-32">
                  {[0, 1, 2, 5, 10].map(r => <option key={r} value={r} className="bg-[#0d0d14]">{r}%</option>)}
                </select>
              </div>
            </div>

            {/* Totals box */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-neutral-400">Sub Total</span><span className="text-white">{formatCurrency(subTotal)}</span></div>
              {!isInterState ? (
                <>
                  <div className="flex justify-between text-sm"><span className="text-neutral-400">CGST</span><span className="text-cyan-400">{formatCurrency(totalCgst)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-neutral-400">SGST</span><span className="text-cyan-400">{formatCurrency(totalSgst)}</span></div>
                </>
              ) : (
                <div className="flex justify-between text-sm"><span className="text-neutral-400">IGST</span><span className="text-cyan-400">{formatCurrency(totalIgst)}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-neutral-400">Gross Amount</span><span className="font-semibold text-white">{formatCurrency(grossAmount)}</span></div>
              {(form.tdsPercentage as number) > 0 && (
                <div className="flex justify-between text-sm"><span className="text-amber-400">TDS ({form.tdsPercentage}%)</span><span className="text-amber-400">-{formatCurrency(tdsAmount)}</span></div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-white/10 pt-2">
                <span className="text-neutral-300">Vendor Payable</span>
                <span className="text-emerald-400 flex items-center gap-1"><IndianRupee size={14} />{formatCurrency(vendorPayable).replace('₹', '')}</span>
              </div>
            </div>
          </div>

          {/* Section 5: Bank Details */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest mb-4">Bank Details (for PDF)</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><label className="block text-sm text-neutral-300 mb-1.5">Bank Name</label>
                <input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} className="input-field" placeholder="HDFC Bank" /></div>
              <div><label className="block text-sm text-neutral-300 mb-1.5">Account Number</label>
                <input value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} className="input-field" placeholder="1234567890" /></div>
              <div><label className="block text-sm text-neutral-300 mb-1.5">IFSC Code</label>
                <input value={form.ifscCode} onChange={e => setForm({ ...form, ifscCode: e.target.value })} className="input-field" placeholder="HDFC0001234" /></div>
              <div><label className="block text-sm text-neutral-300 mb-1.5">Account Holder</label>
                <input value={form.accountHolder} onChange={e => setForm({ ...form, accountHolder: e.target.value })} className="input-field" placeholder="Company Name" /></div>
              <div><label className="block text-sm text-neutral-300 mb-1.5">UPI ID (optional)</label>
                <input value={form.upiId} onChange={e => setForm({ ...form, upiId: e.target.value })} className="input-field" placeholder="name@bank" /></div>
            </div>
          </div>

          {/* Section 6: Notes */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest mb-4">Notes & Terms</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm text-neutral-300 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className="input-field resize-none" placeholder="Internal notes..." /></div>
              <div><label className="block text-sm text-neutral-300 mb-1.5">Terms & Conditions</label>
                <textarea value={form.termsAndConditions} onChange={e => setForm({ ...form, termsAndConditions: e.target.value })} rows={3} className="input-field resize-none" /></div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.06]">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary min-w-[140px]">
              {mutation.isPending ? 'Saving...' : isEdit ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceForm;
