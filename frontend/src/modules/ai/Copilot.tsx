import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '../../services/endpoints';
import { Sparkles, Send, Loader2, User, Bot, ThumbsUp, ThumbsDown } from 'lucide-react';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  feedback?: 'up' | 'down';
}

const SUGGESTIONS = [
  'Which invoices are overdue?',
  'What contracts expire in the next 30 days?',
  'Show me unpaid vendor invoices.',
  'Which purchase orders are still active?',
];

const Copilot: React.FC = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: (history: Msg[]) =>
      aiApi.chat({ messages: history.map(m => ({ role: m.role, content: m.content })) }),
    onSuccess: (result) => {
      setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
    },
    onError: (err: any) => {
      setMessages(prev => [...prev, { role: 'assistant', content: (err?.response?.data?.message || 'The assistant is temporarily unavailable.') }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, chatMutation.isPending]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;
    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    chatMutation.mutate(next);
  };

  const rate = (idx: number, rating: 'up' | 'down') => {
    const m = messages[idx];
    const q = messages[idx - 1];
    setMessages(prev => prev.map((mm, i) => (i === idx ? { ...mm, feedback: rating } : mm)));
    aiApi.sendFeedback({ feature: 'chat', rating, context: { question: q?.content, answer: m.content } }).catch(() => {});
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Sparkles size={24} /> Procurement Copilot</h1>
          <p className="page-description">Ask questions about vendors, invoices, payments, purchase orders and contracts.</p>
        </div>
      </div>

      <div className="glass-card flex-1 flex flex-col overflow-hidden mt-2">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-indigo-400" />
              </div>
              <p className="text-neutral-400 mb-5">Ask me anything about your procurement data.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} className="text-left text-sm text-neutral-300 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0"><Bot size={16} /></div>
              )}
              <div className={`max-w-[75%] ${m.role === 'user' ? 'order-1' : ''}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user' ? 'bg-white text-black rounded-br-sm' : 'bg-white/[0.04] text-neutral-200 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1 mt-1.5 ml-1">
                    {m.feedback ? (
                      <span className="text-[11px] text-neutral-600">Thanks!</span>
                    ) : (
                      <>
                        <button onClick={() => rate(i, 'up')} className="p-1 rounded hover:bg-white/5 text-neutral-600 hover:text-emerald-400"><ThumbsUp size={12} /></button>
                        <button onClick={() => rate(i, 'down')} className="p-1 rounded hover:bg-white/5 text-neutral-600 hover:text-red-400"><ThumbsDown size={12} /></button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 order-2"><User size={16} /></div>
              )}
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0"><Bot size={16} /></div>
              <div className="px-4 py-3 rounded-2xl bg-white/[0.04]"><Loader2 size={16} className="animate-spin text-neutral-400" /></div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="p-4 border-t border-white/[0.06] flex items-center gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about invoices, vendors, contracts..."
            className="input-field flex-1"
            disabled={chatMutation.isPending}
          />
          <button type="submit" disabled={chatMutation.isPending || !input.trim()} className="btn-primary flex items-center gap-2">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Copilot;
