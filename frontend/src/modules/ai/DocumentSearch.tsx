import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { documentApi, aiApi } from '../../services/endpoints';
import { useAuth } from '../../context/AuthContext';
import {
  Search, Loader2, FileText, Sparkles, Database, Check, ThumbsUp, ThumbsDown,
} from 'lucide-react';

const CATEGORIES = ['', 'contract', 'invoice', 'purchase_order', 'vendor_certificate'];

const DocumentSearch: React.FC = () => {
  const { user } = useAuth();
  const canIndex = user?.role === 'admin' || user?.role === 'finance' || user?.role === 'procurement_manager';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState<{ answer: string; sources: any[] } | null>(null);
  const [indexed, setIndexed] = useState<Record<string, number>>({});
  const [feedbackSent, setFeedbackSent] = useState(false);

  const { data: docsData } = useQuery({
    queryKey: ['ai-search-docs'],
    queryFn: () => documentApi.getAll({}),
    enabled: canIndex,
  });
  const docs = docsData?.items || [];

  const searchMutation = useMutation({
    mutationFn: () => aiApi.search({ query, category: category || undefined, topK: 5 }),
    onSuccess: (r) => { setResult(r); setFeedbackSent(false); },
  });

  const indexMutation = useMutation({
    mutationFn: (documentId: string) => aiApi.indexDocument(documentId),
    onSuccess: (r) => setIndexed(prev => ({ ...prev, [r.documentId]: r.chunksIndexed })),
  });

  const sendFeedback = (rating: 'up' | 'down') => {
    aiApi.sendFeedback({ feature: 'search', rating, context: { query, answer: result?.answer } })
      .then(() => setFeedbackSent(true)).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Search size={24} /> Document Search</h1>
          <p className="page-description">Ask questions across your indexed contracts, invoices and purchase orders.</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="glass-card p-4">
        <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) searchMutation.mutate(); }} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
            <Search size={16} className="text-neutral-500" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. What is the termination clause in our vendor contracts?"
              className="bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none w-full" />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-black">{c === '' ? 'All categories' : c.replace('_', ' ')}</option>)}
          </select>
          <button type="submit" disabled={searchMutation.isPending || !query.trim()} className="btn-primary flex items-center gap-2">
            {searchMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
          </button>
        </form>
      </div>

      {/* Answer */}
      {result && (
        <div className="glass-card p-6">
          <h3 className="section-title flex items-center gap-2"><Sparkles size={18} className="text-indigo-400" /> Answer</h3>
          <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{result.answer}</p>

          {result.sources?.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Sources</p>
              <div className="space-y-2">
                {result.sources.map((s: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wide text-neutral-500">[{i + 1}] {s.category}</span>
                      <span className="text-[10px] text-neutral-600">score {s.score}</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{s.chunkText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {/* Indexing panel (write roles only) */}
      {canIndex && (
        <div className="glass-card p-6">
          <h3 className="section-title flex items-center gap-2"><Database size={18} /> Index Documents</h3>
          <p className="text-xs text-neutral-500 mb-4">A document must be indexed before it can be searched. Indexing extracts text, splits it into chunks, and stores embeddings.</p>
          {docs.length === 0 ? (
            <div className="empty-state py-6"><FileText size={28} className="mb-2 opacity-50" /><p className="text-sm">No documents uploaded yet.</p></div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {docs.map((doc: any) => (
                <div key={doc._id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{doc.originalName}</p>
                    <p className="text-xs text-neutral-500">{doc.category}</p>
                  </div>
                  {indexed[doc._id] !== undefined ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 shrink-0"><Check size={14} /> {indexed[doc._id]} chunks</span>
                  ) : (
                    <button
                      onClick={() => indexMutation.mutate(doc._id)}
                      disabled={indexMutation.isPending && indexMutation.variables === doc._id}
                      className="btn-secondary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1"
                    >
                      {indexMutation.isPending && indexMutation.variables === doc._id ? <><Loader2 size={12} className="animate-spin" /> Indexing</> : 'Index'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {indexMutation.isError && (
            <p className="text-xs text-red-400 mt-3">{(indexMutation.error as any)?.response?.data?.message || 'Indexing failed'}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentSearch;
