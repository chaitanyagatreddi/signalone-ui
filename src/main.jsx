import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'motion/react';
import './styles.css';

const examples = [
  'What are Eventbrite customers most frustrated by?',
  'How do users feel about Ticket Tailor support?',
  'Compare refunds complaints across all sources',
];

const reviews = [
  { source: 'G2', date: 'Oct 18, 2026', sentiment: 'Negative', tag: 'fees', text: 'The platform fees are hard to predict until the final checkout step.', color: 'red' },
  { source: 'Trustpilot', date: 'Oct 14, 2026', sentiment: 'Positive', tag: 'UX', text: 'Creating an event is straightforward and the dashboard is easy to learn.', color: 'green' },
  { source: 'Reddit', date: 'Oct 09, 2026', sentiment: 'Neutral', tag: 'support', text: 'Support eventually helped, but the first response took a few days.', color: 'grey' },
  { source: 'Capterra', date: 'Sep 28, 2026', sentiment: 'Negative', tag: 'payouts', text: 'Payout timing is not very clear when an event has been refunded.', color: 'red' },
];

function App() {
  const [source, setSource] = useState('All sources');
  const [brand, setBrand] = useState('Eventbrite');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const runQuestion = (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setQuestion('');
    setMessages((items) => [...items, { role: 'user', text: trimmed }, { role: 'assistant', loading: true }]);
    setLoading(true);
    window.setTimeout(() => setMessages((items) => items.map((item, index) => index === items.length - 1 ? { role: 'assistant', loading: false } : item)), 1500);
    window.setTimeout(() => setLoading(false), 2300);
  };

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><span className="brand-mark">S</span><span>SignalOne</span></div>
      <button className="new-chat" onClick={() => setMessages([])}><span className="plus">+</span> New chat</button>
      <div className="history-label">Recent chats</div>
      <div className="history-list">
        {['Eventbrite sentiment overview', 'Ticket Tailor support feedback', 'Refund complaints by source'].map((item, index) => <button className={`history-item ${index === 0 ? 'active' : ''}`} key={item} onClick={() => setMessages([{ role: 'user', text: item }, { role: 'assistant', loading: false }])}><span className="history-dot" />{item}</button>)}
      </div>
      <div className="sidebar-footer"><div className="avatar">TC</div><div><strong>Ticmint team</strong><span>Workspace</span></div><span className="more">•••</span></div>
    </aside>

    <main className="main-panel">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark small">S</span> SignalOne</div><div className="status-pill"><span /> Live review index</div><button className="help">?</button></header>
      <section className={`chat-area ${messages.length ? 'has-messages' : ''}`}>
        <AnimatePresence mode="wait">
          {!messages.length ? <motion.div className="empty-state" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .35 }}>
            <div className="hero-mark"><span className="brand-mark large">S</span></div>
            <h1>What do you want to know?</h1>
            <p>Ask SignalOne to find the signal in your customer reviews.</p>
            <div className="example-grid">{examples.map((example, index) => <motion.button key={example} className="example-card" onClick={() => { setQuestion(example); inputRef.current?.focus(); }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .08 + .12 }}><span>{example}</span><span className="arrow">↗</span></motion.button>)}</div>
          </motion.div> : <motion.div className="thread" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {messages.map((message, index) => <motion.div className={`message-row ${message.role}`} key={`${message.text || 'answer'}-${index}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
              {message.role === 'user' ? <div className="user-bubble">{message.text}</div> : <Answer loading={message.loading} brand={brand} source={source} />}
            </motion.div>)}
            {loading && <div className="progress-note"><span className="pulse" /> Fetching reviews <span className="progress-sep">→</span> Scoring…</div>}
          </motion.div>}
        </AnimatePresence>
      </section>

      <div className="composer-wrap">
        <div className="composer">
          <div className="controls"><label>Source<select value={source} onChange={(event) => setSource(event.target.value)}><option>All sources</option><option>G2</option><option>Capterra</option><option>Trustpilot</option><option>Reddit</option></select></label><span className="control-divider" /><label>Brand<input value={brand} onChange={(event) => setBrand(event.target.value)} /></label></div>
          <div className="message-input"><textarea ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); runQuestion(); } }} placeholder="Ask about your customer reviews…" rows="1" /><button className="send" onClick={() => runQuestion()} disabled={!question.trim() || loading} aria-label="Send question">↗</button></div>
        </div>
        <div className="composer-hint"><span>SignalOne can make mistakes. Review original sources before making decisions.</span><span><kbd>⌘</kbd><kbd>K</kbd> to focus</span></div>
      </div>
    </main>
  </div>;
}

function Answer({ loading, brand, source }) {
  const [typed, setTyped] = useState('');
  const summary = `Across ${source === 'All sources' ? 'the review sources' : source} for ${brand || 'your brand'}, customers are generally positive about the core experience. The clearest friction is around fees and how quickly support resolves issues.`;
  useEffect(() => {
    if (loading) return;
    let index = 0;
    setTyped('');
    const timer = window.setInterval(() => { index += 1; setTyped(summary.slice(0, index)); if (index >= summary.length) window.clearInterval(timer); }, 16);
    return () => window.clearInterval(timer);
  }, [loading, brand, source]);
  if (loading) return <div className="answer loading-card"><div className="skeleton title-sk" /><div className="skeleton line-sk" /><div className="skeleton line-sk short" /></div>;
  return <div className="answer"><div className="answer-head"><span className="assistant-mark">S</span><span>SignalOne</span><span className="answer-time">Just now</span></div><p className="summary">{typed}<span className="cursor">▌</span></p><div className="sentiment-row"><span className="sentiment positive">72% positive</span><span className="sentiment neutral">18% neutral</span><span className="sentiment negative">10% negative</span></div><div className="section-label">Top complaints</div><div className="complaints"><div><span className="complaint-name">Fees</span><span className="complaint-share">31% of negative reviews</span><div className="bar"><i style={{ width: '31%' }} /></div></div><div><span className="complaint-name">Support</span><span className="complaint-share">24% of negative reviews</span><div className="bar"><i style={{ width: '24%' }} /></div></div><div><span className="complaint-name">Payouts</span><span className="complaint-share">16% of negative reviews</span><div className="bar"><i style={{ width: '16%' }} /></div></div></div><div className="section-label reviews-label">Reviews <span>4 matched</span></div><div className="review-list">{reviews.map((review) => <div className="review" key={review.source + review.date}><div className="review-meta"><span className="review-source">{review.source}</span><span>{review.date}</span><span className={`review-sentiment ${review.color}`}>{review.sentiment}</span><span className="tag">{review.tag}</span><a href="#source" onClick={(event) => event.preventDefault()}>Open ↗</a></div><p>“{review.text}”</p></div>)}</div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
