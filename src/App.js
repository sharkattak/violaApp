import { useState, useRef, useEffect } from 'react';
import './App.css';
import logo from './logo.png';

// ── Constants ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Viola, a warm, calm, and knowledgeable health companion designed specifically for teenage girls aged 14–19. You explain body symptoms in plain, non-scary language like a trusted older sister who happens to have medical knowledge.

Your job is to:
1. Acknowledge what they're experiencing with empathy
2. Explain what this symptom usually means in simple, reassuring terms
3. Tell them if it's normal, something to monitor, or when to see a doctor
4. Never diagnose — always explain possibilities and give guidance

ALWAYS end every response with a structured JSON block (after your conversational response) in this exact format:
---VIOLA_DATA---
{
  "urgencyLevel": "normal" | "monitor" | "see_doctor" | "emergency",
  "urgencyLabel": "Short label like 'Totally Normal' or 'Worth Checking' or 'See a Doctor' or 'Get Help Today'",
  "quickTip": "One sentence practical tip"
}
---END_VIOLA_DATA---

Urgency levels:
- "normal": Common, expected, nothing to worry about
- "monitor": Not dangerous but worth keeping an eye on
- "see_doctor": Should book an appointment within days/weeks
- "emergency": Needs medical attention today

IMPORTANT: You are NOT a doctor. Always encourage professional care when uncertain. Never shame or judge. Be warm, specific, and helpful. Keep your main response to 3–5 short paragraphs max. Use simple language.`;

const URGENCY_CONFIG = {
  normal: {
    color: '#4ade80',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    icon: '✓',
    textColor: '#166534',
  },
  monitor: {
    color: '#fb923c',
    bg: '#fff7ed',
    border: '#fed7aa',
    icon: '◉',
    textColor: '#9a3412',
  },
  see_doctor: {
    color: '#60a5fa',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: '♡',
    textColor: '#1e40af',
  },
  emergency: {
    color: '#f87171',
    bg: '#fef2f2',
    border: '#fecaca',
    icon: '!',
    textColor: '#991b1b',
  },
};

const QUICK_PROMPTS = [
  'My period is brown instead of red',
  'Pain when inserting a tampon',
  'My discharge smells different than usual',
  'I\'ve been spotting between periods',
  'My period is really heavy this month',
  'I have cramps but no period yet',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function parseViolaResponse(text) {
  const match = text.match(/---VIOLA_DATA---([\s\S]*?)---END_VIOLA_DATA---/);
  if (!match) return { message: text, data: null };
  try {
    const data = JSON.parse(match[1].trim());
    const message = text.replace(/---VIOLA_DATA---([\s\S]*?)---END_VIOLA_DATA---/, '').trim();
    return { message, data };
  } catch {
    return { message: text, data: null };
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function UrgencyBadge({ level, label }) {
  if (!level) return null;
  const config = URGENCY_CONFIG[level] || URGENCY_CONFIG.normal;
  return (
    <div
      className="urgency-badge"
      style={{ background: config.bg, borderColor: config.border, color: config.textColor }}
    >
      <span
        className="urgency-badge__icon"
        style={{ background: config.color }}
      >
        {config.icon}
      </span>
      {label}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="typing">
      <img src={logo} alt="Viola" className="typing__avatar" />
      <div className="typing__bubble">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="typing__dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`message message--${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="message__sender">
          <img src={logo} alt="Viola" className="message__avatar" />
          <span className="message__sender-name">Viola</span>
        </div>
      )}

      <div className={`message__bubble message__bubble--${isUser ? 'user' : 'assistant'}`}>
        {msg.content}
      </div>

      {!isUser && msg.violaData && (
        <div className="message__meta">
          <UrgencyBadge level={msg.violaData.urgencyLevel} label={msg.violaData.urgencyLabel} />
          {msg.violaData.quickTip && (
            <p className="message__tip">💡 {msg.violaData.quickTip}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput('');
    setShowWelcome(false);

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.role === 'assistant' ? (m.rawContent || m.content) : m.content,
      }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      const rawContent = data.content?.[0]?.text || 'I\'m having trouble responding right now. Please try again.';
      const { message, data: violaData } = parseViolaResponse(rawContent);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: message, rawContent, violaData },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again in a moment.', violaData: null },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaInput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    setInput(e.target.value);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <img src={logo} alt="Viola logo" className="header__logo" />
        <div>
          <div className="header__name">viola</div>
          <div className="header__tagline">your personal health companion</div>
        </div>
        <div className="header__status">
          <div className="header__status-dot" />
          <span className="header__status-label">Online</span>
        </div>
      </header>

      {/* Chat */}
      <main className="chat-area">
        {showWelcome && (
          <div className="welcome">
            <div className="welcome__hero">
              <img src={logo} alt="Viola" className="welcome__logo" />
              <h1 className="welcome__title">Hi, I'm Viola</h1>
              <p className="welcome__subtitle">
                Your safe space to ask anything about your body. No judgment, no panic — just honest, clear answers.
              </p>
            </div>

            <div className="welcome__disclaimer">
              ⚠️ <strong>Viola is not a doctor.</strong> I give general information to help you understand your body
              better. Always see a healthcare professional for medical concerns.
            </div>

            <div>
              <p className="welcome__prompts-label">Or try one of these...</p>
              <div className="welcome__prompts">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button key={i} className="quick-prompt" onClick={() => sendMessage(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {loading && <TypingIndicator />}

        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <div className="input-bar">
        <div className="input-bar__inner">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your body..."
            rows={1}
            className="input-bar__textarea"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="input-bar__send"
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
        <p className="input-bar__footer">viola · not a substitute for medical advice</p>
      </div>
    </div>
  );
}

export default App;
