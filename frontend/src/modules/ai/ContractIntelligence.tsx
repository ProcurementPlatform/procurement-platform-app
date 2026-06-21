import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { documentApi, aiApi } from '../../services/endpoints';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  FileSearch, FileText, Loader2, AlertTriangle, ChevronRight, ThumbsUp, ThumbsDown,
} from 'lucide-react';

const riskStyles: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const ContractIntelligence: React.FC = () => {
  const [selected, setSelected] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-contract-docs'],
    queryFn: () => documentApi.getAll({ category: 'contract' }),
  });
  const docs = data?.items || [];

  const analyzeMutation = useMutation({
    mutationFn: (documentId: string) => aiApi.analyzeContract(documentId),
    onSuccess: (result) => { setAnalysis(result); setFeedbackSent(false); },
  });

  const pick = (doc: any) => {
    setSelected(doc);
    setAnalysis(null);
    analyzeMutation.reset();
    aiApi.getContractAnalysis(doc._id).then(setAnalysis).catch(() => setAnalysis(null));
  };

  const sendFeedback = (rating: 'up' | 'down') => {
    aiApi.sendFeedback({ feature: 'contract', referenceId: analysis?._id, rating, context: { documentId: analysis?.documentId } })
      .then(() => setFeedbackSent(true)).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><FileSearch size={24} /> Contract Intelligence</h1>
          <p className="page-description">Extract key terms, clauses and renewal risk from uploaded contract documents.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document picker */}
        <div className="glass-card p-4 lg:col-span-1 h-fit">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3 px-1">Contract Documents</h3>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              [...Array(5)].map((_, i) => <div key={i} className="loading-skeleton h-12 rounded-lg" />)
            ) : docs.length === 0 ? (
              <div className="empty-state py-8 text-center text-sm">
                <FileText size={28} className="mx-auto mb-2 opacity-50" />
                <p>No contract documents.</p>
                <p className="text-xs text-neutral-600 mt-1">Upload a contract (category "contract") under Documents first.</p>
              </div>
            ) : (
              docs.map((doc: any) => (
                <button key={doc._id} onClick={() => pick(doc)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors ${selected?._id === doc._id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{doc.originalName}</p>
                    <p className="text-xs text-neutral-500">{formatDate(doc.createdAt)}</p>
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
            <div className="glass-card p-12 empty-state"><FileText size={40} className="mb-3 opacity-50" /><p>Select a contract to analyze</p></div>
          ) : (
            <>
              <div className="glass-card p-5 flex items-center justify-between flex-wrap gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{selected.originalName}</p>
                  <p className="text-xs text-neutral-500">{(selected.size / 1024).toFixed(0)} KB · {selected.mimeType}</p>
                </div>
                <button onClick={() => analyzeMutation.mutate(selected._id)} disabled={analyzeMutation.isPending} className="btn-primary flex items-center gap-2">
                  {analyzeMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</> : <><FileSearch size={16} /> {analysis ? 'Re-analyze' : 'Analyze'}</>}
                </button>
              </div>

              {analyzeMutation.isError && (
                <div className="glass-card p-4 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} /> {(analyzeMutation.error as any)?.response?.data?.message || 'Analysis failed'}
                </div>
              )}

              {analysis && analysis.status === 'failed' && (
                <div className="glass-card p-4 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} /> {analysis.summary}
                </div>
              )}

              {analysis && analysis.status !== 'failed' && (
                <>
                  {/* Metadata + renewal risk */}
                  <div className="glass-card p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <div><p className="text-xs text-neutral-500">Vendor</p><p className="text-white">{analysis.vendorName || '—'}</p></div>
                        <div><p className="text-xs text-neutral-500">Contract No.</p><p className="text-white">{analysis.contractNumber || '—'}</p></div>
                        <div><p className="text-xs text-neutral-500">Value</p><p className="text-white">{analysis.contractValue ? formatCurrency(analysis.contractValue) : '—'}</p></div>
                        <div><p className="text-xs text-neutral-500">Expiry</p><p className="text-white">{analysis.expiryDate ? formatDate(analysis.expiryDate) : '—'}</p></div>
                      </div>
                      {analysis.renewalRisk && (
                        <div className={`px-4 py-3 rounded-xl border text-center ${riskStyles[analysis.renewalRisk.riskLevel] || riskStyles.low}`}>
                          <p className="text-xs uppercase tracking-wide">Renewal Risk</p>
                          <p className="text-lg font-bold capitalize">{analysis.renewalRisk.riskLevel}</p>
                          {typeof analysis.renewalRisk.daysToExpiry === 'number' && <p className="text-[11px] opacity-80">{analysis.renewalRisk.daysToExpiry} days to expiry</p>}
                        </div>
                      )}
                    </div>
                    {analysis.renewalRisk?.reasoning && <p className="text-xs text-neutral-400 mt-4">{analysis.renewalRisk.reasoning}</p>}
                  </div>

                  {/* Summary */}
                  {analysis.summary && (
                    <div className="glass-card p-6">
                      <h3 className="section-title">Summary</h3>
                      <p className="text-sm text-neutral-300 leading-relaxed">{analysis.summary}</p>
                    </div>
                  )}

                  {/* Key terms */}
                  {analysis.keyTerms?.length > 0 && (
                    <div className="glass-card p-6">
                      <h3 className="section-title">Key Terms</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        {analysis.keyTerms.map((t: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-xs text-neutral-500">{t.label}</p>
                            <p className="text-sm text-white">{t.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clauses */}
                  {analysis.clauses?.length > 0 && (
                    <div className="glass-card p-6">
                      <h3 className="section-title">Important Clauses</h3>
                      <div className="space-y-3 mt-2">
                        {analysis.clauses.map((c: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize shrink-0 ${riskStyles[c.riskLevel] || riskStyles.low}`}>{c.riskLevel}</span>
                            <div>
                              <p className="text-sm text-white font-medium capitalize">{c.clauseType}</p>
                              <p className="text-xs text-neutral-400 mt-0.5">{c.summary}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                        <span className="text-xs text-neutral-500">Was this helpful?</span>
                        {feedbackSent ? <span className="text-xs text-emerald-400">Thanks!</span> : (
                          <>
                            <button onClick={() => sendFeedback('up')} className="p-1.5 rounded hover:bg-white/5 text-neutral-400 hover:text-emerald-400"><ThumbsUp size={14} /></button>
                            <button onClick={() => sendFeedback('down')} className="p-1.5 rounded hover:bg-white/5 text-neutral-400 hover:text-red-400"><ThumbsDown size={14} /></button>
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

export default ContractIntelligence;
