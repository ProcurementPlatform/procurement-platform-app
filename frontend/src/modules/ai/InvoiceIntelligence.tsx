import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { invoiceApi, aiApi } from '../../services/endpoints';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  ScanSearch, Search, AlertTriangle, ShieldCheck, ThumbsUp, ThumbsDown,
  Loader2, FileText, ChevronRight,
} from 'lucide-react';

const riskStyles: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const severityStyles: Record<string, string> = {
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
};

const findingLabel: Record<string, string> = {
  duplicate: 'Duplicate Invoice',
  missing_reference: 'Missing Reference',
  amount_mismatch: 'Amount Mismatch',
  overbilling: 'Overbilling',
  contract_violation: 'Contract Violation',
  other: 'Other',
};

const InvoiceIntelligence: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-invoices', search],
    queryFn: () => invoiceApi.getAll({ page: 1, limit: 20, search }),
  });
  const invoices = data?.items || [];

  const analyzeMutation = useMutation({
    mutationFn: (invoiceId: string) => aiApi.analyzeInvoice(invoiceId),
    onSuccess: (result) => { setAnalysis(result); setFeedbackSent(false); },
  });

  const feedbackMutation = useMutation({
    mutationFn: (rating: 'up' | 'down') =>
      aiApi.sendFeedback({
        feature: 'invoice',
        referenceId: analysis?._id,
        rating,
        context: { invoiceId: analysis?.invoiceId, riskLevel: analysis?.riskLevel },
      }),
    onSuccess: () => setFeedbackSent(true),
  });

  const pickInvoice = (inv: any) => {
    setSelected(inv);
    setAnalysis(null);
    analyzeMutation.reset();
    // Try to load a prior analysis; ignore 404.
    aiApi.getInvoiceAnalysis(inv._id).then(setAnalysis).catch(() => setAnalysis(null));
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><ScanSearch size={24} /> Invoice Intelligence</h1>
          <p className="page-description">Automated invoice validation — duplicate, mismatch, overbilling & contract-violation detection with an AI summary.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice picker */}
        <div className="glass-card p-4 lg:col-span-1 h-fit">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 mb-3">
            <Search size={16} className="text-neutral-500" />
            <input
              type="text" placeholder="Search invoices..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none w-full"
            />
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              [...Array(5)].map((_, i) => <div key={i} className="loading-skeleton h-12 rounded-lg" />)
            ) : invoices.length === 0 ? (
              <div className="empty-state py-8"><p>No invoices found</p></div>
            ) : (
              invoices.map((inv: any) => (
                <button
                  key={inv._id}
                  onClick={() => pickInvoice(inv)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                    selected?._id === inv._id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-white truncate">{inv.invoiceNumber}</p>
                    <p className="text-xs text-neutral-500 truncate">{inv.partyName} · {formatCurrency(inv.totalAmount || inv.grossAmount || 0)}</p>
                  </div>
                  <ChevronRight size={14} className="text-neutral-600 shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Analysis panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="glass-card p-12 empty-state">
              <FileText size={40} className="mb-3 opacity-50" />
              <p>Select an invoice to analyze</p>
            </div>
          ) : (
            <>
              <div className="glass-card p-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-mono text-white">{selected.invoiceNumber}</p>
                  <p className="text-xs text-neutral-500">{selected.partyName} · Due {formatDate(selected.dueDate)}</p>
                </div>
                <button
                  onClick={() => analyzeMutation.mutate(selected._id)}
                  disabled={analyzeMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {analyzeMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</> : <><ScanSearch size={16} /> {analysis ? 'Re-analyze' : 'Analyze'}</>}
                </button>
              </div>

              {analyzeMutation.isError && (
                <div className="glass-card p-4 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} /> {(analyzeMutation.error as any)?.response?.data?.message || 'Analysis failed'}
                </div>
              )}

              {analysis && (
                <>
                  {/* Risk score */}
                  <div className="glass-card p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-20 h-20 rounded-2xl border flex flex-col items-center justify-center ${riskStyles[analysis.riskLevel] || riskStyles.low}`}>
                          <span className="text-2xl font-bold">{analysis.riskScore}</span>
                          <span className="text-[10px] uppercase tracking-wide">risk</span>
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border capitalize ${riskStyles[analysis.riskLevel] || riskStyles.low}`}>
                            {analysis.riskLevel === 'low' ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                            {analysis.riskLevel} risk
                          </span>
                          <p className="text-xs text-neutral-500 mt-2">{analysis.findings?.length || 0} finding(s) · rule engine {analysis.ruleEngineVersion}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Findings */}
                  <div className="glass-card p-6">
                    <h3 className="section-title">Findings</h3>
                    {(!analysis.findings || analysis.findings.length === 0) ? (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm mt-2"><ShieldCheck size={16} /> No issues detected by the automated checks.</div>
                    ) : (
                      <div className="space-y-3 mt-3">
                        {analysis.findings.map((f: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <AlertTriangle size={16} className={`${severityStyles[f.severity] || ''} mt-0.5 shrink-0`} />
                            <div>
                              <p className="text-sm text-white font-medium">{findingLabel[f.findingType] || f.findingType} <span className={`text-xs ${severityStyles[f.severity] || ''} capitalize`}>· {f.severity}</span></p>
                              <p className="text-xs text-neutral-400 mt-0.5">{f.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* AI narrative */}
                  {(analysis.report || (analysis.recommendations?.length > 0)) && (
                    <div className="glass-card p-6">
                      <h3 className="section-title">AI Summary</h3>
                      {analysis.report && <p className="text-sm text-neutral-300 leading-relaxed">{analysis.report}</p>}
                      {analysis.recommendations?.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Recommendations</p>
                          <ul className="space-y-1.5">
                            {analysis.recommendations.map((r: string, i: number) => (
                              <li key={i} className="text-sm text-neutral-300 flex items-start gap-2"><span className="text-indigo-400 mt-0.5">→</span> {r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* Feedback */}
                      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                        <span className="text-xs text-neutral-500">Was this helpful?</span>
                        {feedbackSent ? (
                          <span className="text-xs text-emerald-400">Thanks for your feedback!</span>
                        ) : (
                          <>
                            <button onClick={() => feedbackMutation.mutate('up')} className="p-1.5 rounded hover:bg-white/5 text-neutral-400 hover:text-emerald-400"><ThumbsUp size={14} /></button>
                            <button onClick={() => feedbackMutation.mutate('down')} className="p-1.5 rounded hover:bg-white/5 text-neutral-400 hover:text-red-400"><ThumbsDown size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceIntelligence;
