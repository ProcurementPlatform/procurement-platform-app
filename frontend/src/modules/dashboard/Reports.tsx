import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../../services/endpoints';
import { formatCurrency, formatDate } from '../../lib/utils';
import { BarChart3, FileDown, FileText } from 'lucide-react';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('procurement');

  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ['report', 'vendors'],
    queryFn: () => reportApi.vendor(),
    enabled: activeTab === 'vendors',
  });

  const { data: procurementData, isLoading: procurementLoading } = useQuery({
    queryKey: ['report', 'procurement'],
    queryFn: () => reportApi.procurement(),
    enabled: activeTab === 'procurement',
  });

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: ['report', 'invoices'],
    queryFn: () => reportApi.invoice(),
    enabled: activeTab === 'invoices',
  });

  const { data: contractData, isLoading: contractLoading } = useQuery({
    queryKey: ['report', 'contracts'],
    queryFn: () => reportApi.contract(),
    enabled: activeTab === 'contracts',
  });

  const tabs = [
    { id: 'procurement', label: 'Procurement' },
    { id: 'vendors', label: 'Vendors' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'contracts', label: 'Contracts' },
  ];

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = vendorLoading || procurementLoading || invoiceLoading || contractLoading;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Reports</h1><p className="page-description">Generate and export procurement reports</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.02] rounded-lg p-1 border border-white/[0.06] w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="loading-skeleton h-10 rounded" />)}</div>
        ) : activeTab === 'procurement' ? (
          <>
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center">
              <h3 className="font-semibold">Procurement Report</h3>
              <button onClick={() => exportCSV(procurementData?.data || [], 'procurement-report')} className="btn-secondary text-xs flex items-center gap-2"><FileDown size={14} /> Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Request Title</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Department</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Estimated Cost</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Status</th>
                </tr></thead>
                <tbody>
                  {(procurementData?.data || []).map((pr: any) => (
                    <tr key={pr._id} className="table-row">
                      <td className="px-6 py-3 text-sm text-white">{pr.title}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400 capitalize">{pr.department}</td>
                      <td className="px-6 py-3 text-sm text-white">{formatCurrency(pr.estimatedCost)}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400 capitalize">{pr.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === 'vendors' ? (
          <>
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center">
              <h3 className="font-semibold">Vendor Report</h3>
              <button onClick={() => exportCSV(vendorData?.data || [], 'vendor-report')} className="btn-secondary text-xs flex items-center gap-2"><FileDown size={14} /> Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Vendor</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Code</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Contact</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Rating</th>
                </tr></thead>
                <tbody>
                  {(vendorData?.data || []).map((v: any) => (
                    <tr key={v._id} className="table-row">
                      <td className="px-6 py-3 text-sm text-white">{v.vendorName}</td>
                      <td className="px-6 py-3 text-sm font-mono text-neutral-400">{v.vendorCode}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400">{v.contactPerson}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400 capitalize">{v.status}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400">{v.rating}/5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === 'invoices' ? (
          <>
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center">
              <h3 className="font-semibold">Invoice Report</h3>
              <button onClick={() => exportCSV(invoiceData?.data || [], 'invoice-report')} className="btn-secondary text-xs flex items-center gap-2"><FileDown size={14} /> Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Invoice</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Vendor</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Due</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Status</th>
                </tr></thead>
                <tbody>
                  {(invoiceData?.data || []).map((inv: any) => (
                    <tr key={inv._id} className="table-row">
                      <td className="px-6 py-3 text-sm font-mono text-white">{inv.invoiceNumber}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400">{typeof inv.vendor === 'object' ? inv.vendor?.vendorName : '—'}</td>
                      <td className="px-6 py-3 text-sm text-white">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-6 py-3 text-sm text-neutral-500">{formatDate(inv.dueDate)}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400 capitalize">{inv.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center">
              <h3 className="font-semibold">Contract Report</h3>
              <button onClick={() => exportCSV(contractData?.data || [], 'contract-report')} className="btn-secondary text-xs flex items-center gap-2"><FileDown size={14} /> Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/[0.06]">
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Contract</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Vendor</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Value</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Expiry</th>
                  <th className="text-left text-xs font-medium text-neutral-500 px-6 py-3">Status</th>
                </tr></thead>
                <tbody>
                  {(contractData?.data || []).map((c: any) => (
                    <tr key={c._id} className="table-row">
                      <td className="px-6 py-3 text-sm text-white">{c.contractName}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400">{typeof c.vendor === 'object' ? c.vendor?.vendorName : '—'}</td>
                      <td className="px-6 py-3 text-sm text-white">{formatCurrency(c.contractValue)}</td>
                      <td className="px-6 py-3 text-sm text-neutral-500">{formatDate(c.expiryDate)}</td>
                      <td className="px-6 py-3 text-sm text-neutral-400 capitalize">{c.status?.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
