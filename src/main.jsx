import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'motion/react';
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Placeholder } from '@tiptap/extensions';
import './styles.css';

const examples = ['What are Eventbrite customers most frustrated by?', 'How do users feel about Ticket Tailor support?', 'Compare refunds complaints across all sources'];
const API = import.meta.env.VITE_API_URL || '';
const HISTORY_KEY = 'signalone-history';
const sentimentColor = { positive: 'green', neutral: 'grey', negative: 'red' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// WebMCP: while this page is open, browser AI agents can call these tools (Chrome, flag or origin trial).
// Format from developer.chrome.com/docs/ai/webmcp/imperative-api. No-op where WebMCP isn't available.
function useWebMCP() {
  useEffect(() => {
    const mc = document.modelContext;
    if (!mc?.registerTool) return;
    const controller = new AbortController();
    const brands = ['Eventbrite', 'Ticket Tailor', 'Townscript', 'BookMyShow'];
    mc.registerTool({
      name: 'analyze_reviews',
      description: 'Fetch fresh G2, Trustpilot and Reddit reviews for a ticketing brand and return a verified sentiment answer with review links. Takes about a minute.',
      inputSchema: { type: 'object', properties: {
        brand: { type: 'string', enum: brands },
        source: { type: 'string', enum: ['All sources', 'G2', 'Trustpilot', 'Reddit'] },
        question: { type: 'string', description: 'What to ask about the reviews' },
      }, required: ['brand'] },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ brand, source = 'All sources', question = '' }, { signal } = {}) => {
        const res = await fetch(`${API}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand, source, question }), signal });
        const d = await res.json();
        if (!res.ok) return `Error: ${d.error || res.status}`;
        const cites = d.reviews.map((r, i) => `[${i + 1}] ${r.source} ${r.sentiment} ${r.tag}: ${r.url}`).join('\n');
        return `${d.summary}\n\nSentiment %: ${JSON.stringify(d.sentiment)}\nTop complaints: ${JSON.stringify(d.complaints)}\nVerified: ${d.verified}\n\nReviews:\n${cites}`;
      },
    }, { signal: controller.signal });
    mc.registerTool({
      name: 'get_saved_reviews',
      description: 'Return reviews already saved by SignalOne (same data as the Google Sheet), optionally for one brand.',
      inputSchema: { type: 'object', properties: { brand: { type: 'string', enum: brands } } },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async ({ brand } = {}, { signal } = {}) => {
        const d = await (await fetch(`${API}/sheet-rows`, { signal })).json();
        const rows = d.rows.filter((r) => !brand || r[0] === brand);
        return JSON.stringify({ columns: d.columns, count: rows.length, rows: rows.slice(0, 50) });
      },
    }, { signal: controller.signal });
    return () => controller.abort();
  }, []);
}

// Turns "...fees [3][7]." into text with citation links to the cited reviews.
function Cited({ text, reviews }) {
  return text.split(/(\[\d+\])/).map((part, i) => {
    const n = part.match(/^\[(\d+)\]$/)?.[1];
    const r = n && reviews[n - 1];
    return r ? <a key={i} className="cite" href={r.url} target="_blank" rel="noreferrer" title={r.text}>[{n}]</a> : part;
  });
}

function Composer({ value, setValue, onSend }) {
  const sendRef = useRef(onSend); sendRef.current = onSend;
  const editor = useEditor({
    extensions: [Document, Paragraph, Text, Placeholder.configure({ placeholder: 'Ask about your customer reviews…' })],
    editorProps: { attributes: { class: 'tiptap-input', role: 'textbox', 'aria-label': 'Question' }, handleKeyDown: (_, event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendRef.current(); return true; } return false; } },
    onUpdate: ({ editor }) => setValue(editor.getText()),
  });
  useEffect(() => { if (editor && editor.getText() !== value) editor.commands.setContent(value ? `<p>${value.replace(/</g, '&lt;')}</p>` : ''); }, [editor, value]);
  return <div className="message-input"><EditorContent editor={editor} className="tiptap-wrap" /> <button className="send" onClick={onSend} disabled={!value.trim()} aria-label="Send question">↗</button></div>;
}

function Answer({ loading, data, error }) {
  const summary = data?.summary || '';
  const [typed, setTyped] = useState('');
  useEffect(() => { if (loading || !summary) return; let index = 0; setTyped(''); const timer = setInterval(() => { setTyped(summary.slice(0, ++index)); if (index >= summary.length) clearInterval(timer); }, 14); return () => clearInterval(timer); }, [loading, summary]);
  if (loading) return <div className="answer loading-card"><div className="skeleton title-sk" /><div className="skeleton line-sk" /><div className="skeleton line-sk short" /></div>;
  const head = <div className="answer-head"><span className="assistant-mark">S</span><span>SignalOne</span><span className="answer-time">Just now</span></div>;
  if (error) return <div className="answer">{head}<p className="summary">Couldn't get an answer: {error}</p></div>;
  const { sentiment, complaints, reviews, verified } = data;
  return <div className="answer">{head}<p className="summary">{typed.length < summary.length ? typed : <Cited text={summary} reviews={reviews} />}{typed.length < summary.length && <span className="cursor">▌</span>}</p>{!verified && <p className="summary">⚠ Summary not fully verified against the reviews.</p>}<div className="sentiment-row">{['positive', 'neutral', 'negative'].map((k) => <span key={k} className={`sentiment ${k}`}>{sentiment[k]}% {k}</span>)}</div><div className="section-label">Top complaints</div><div className="complaints">{complaints.map(({ label, share }) => <div key={label}><span className="complaint-name">{cap(label)}</span><span className="complaint-share">{share}% of negative reviews</span><div className="bar"><i style={{ width: `${share}%` }} /></div></div>)}</div><div className="section-label reviews-label">Reviews <span>{reviews.length} matched</span></div><div className="review-list">{reviews.map((r, i) => <div className="review" key={i}><div className="review-meta"><span className="review-source">[{i + 1}] {r.source}</span><span>{r.date}</span><span className={`review-sentiment ${sentimentColor[r.sentiment]}`}>{cap(r.sentiment)}</span><span className="tag">{r.tag}</span><a href={r.url} target="_blank" rel="noreferrer">Open ↗</a></div><p>“{r.text}”</p></div>)}</div></div>;
}

function App() {
  useWebMCP();
  const [source, setSource] = useState('All sources'); const [brand, setBrand] = useState('Eventbrite'); const [question, setQuestion] = useState(''); const [messages, setMessages] = useState([]); const [loading, setLoading] = useState(false);
  // Past searches, saved in this browser so they can be reopened without asking the agent again.
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } });
  const remember = (entry) => setHistory((items) => { const next = [entry, ...items].slice(0, 30); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {} return next; });
  const reopen = (h) => { if (loading) return; setBrand(h.brand); setSource(h.source); setMessages([{ role: 'user', text: h.question }, { role: 'assistant', data: h.data }]); };
  const send = () => { if (!question.trim() || loading) return; const text = question.trim(); setQuestion(''); setMessages((items) => [...items, { role: 'user', text }, { role: 'assistant', loading: true }]); setLoading(true); const finish = (patch) => { setMessages((items) => items.map((item, index) => index === items.length - 1 ? { ...item, loading: false, ...patch } : item)); setLoading(false); }; fetch(`${API}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, brand, source }) }).then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`); finish({ data: body }); remember({ question: text, brand, source, data: body, at: Date.now() }); }).catch((e) => finish({ error: e.message })); };
  const reset = () => { setMessages([]); setQuestion(''); };
  return <div className="app-shell"><aside className="sidebar"><div className="brand-lockup"><span className="brand-mark">S</span><span>SignalOne</span></div><button className="new-chat" onClick={reset}><span className="plus">+</span> New chat</button><div className="history-label">Recent chats</div><div className="history-list">{history.length ? history.map((h) => <button className={`history-item ${messages[0]?.text === h.question && messages[1]?.data === h.data ? 'active' : ''}`} key={h.at} onClick={() => reopen(h)} title={`${h.brand} · ${h.source}`}><span className="history-dot" />{h.question}</button>) : <span className="history-empty">Your questions will show here.</span>}</div><div className="sidebar-footer"><div className="avatar">TC</div><div><strong>Ticmint team</strong><span>Workspace</span></div><span className="more">•••</span></div></aside><main className="main-panel"><header className="topbar"><div className="mobile-brand"><span className="brand-mark small">S</span> SignalOne</div><div className="status-pill"><span /> Live review index</div><button className="help">?</button></header><section className={`chat-area ${messages.length ? 'has-messages' : ''}`}><AnimatePresence mode="wait">{!messages.length ? <motion.div className="empty-state" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><div className="hero-mark"><span className="brand-mark large">S</span></div><h1>What do you want to know?</h1><p>Ask SignalOne to find the signal in your customer reviews.</p><div className="example-grid">{examples.map((example, index) => <motion.button className="example-card" key={example} onClick={() => setQuestion(example)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .08 + .12 }}><span>{example}</span><span className="arrow">↗</span></motion.button>)}</div></motion.div> : <motion.div className="thread" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{messages.map((message, index) => <motion.div className={`message-row ${message.role}`} key={`${message.role}-${index}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><>{message.role === 'user' ? <div className="user-bubble">{message.text}</div> : <Answer loading={message.loading} data={message.data} error={message.error} />}</></motion.div>)}{loading && <div className="progress-note"><span className="pulse" /> Fetching reviews <span className="progress-sep">→</span> Scoring…</div>}</motion.div>}</AnimatePresence></section><div className="composer-wrap"><div className="composer"><div className="controls"><label>Source<select value={source} onChange={(event) => setSource(event.target.value)}><option>All sources</option><option>G2</option><option>Reddit</option><option>Trustpilot</option></select></label><span className="control-divider" /><label>Brand<input value={brand} onChange={(event) => setBrand(event.target.value)} /></label></div><Composer value={question} setValue={setQuestion} onSend={send} /></div><div className="composer-hint"><span>SignalOne can make mistakes. Review original sources before making decisions.</span><span><kbd>⌘</kbd><kbd>K</kbd> to focus</span></div></div></main></div>;
}

createRoot(document.getElementById('root')).render(<App />);
