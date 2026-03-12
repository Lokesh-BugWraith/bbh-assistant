import { useState, useRef, useEffect } from "react";

const MODES = [
  { id: "report", label: "Report Writer", icon: "◈", shortLabel: "Report", desc: "Generate structured vuln reports", color: "#00ff88" },
  { id: "attack", label: "Attack Vectors", icon: "⬡", shortLabel: "Attack", desc: "Brainstorm exploitation paths", color: "#ff4466" },
  { id: "triage", label: "Triage Response", icon: "◎", shortLabel: "Triage", desc: "Craft dispute replies", color: "#ffaa00" },
  { id: "hunt", label: "Hunt Tips", icon: "◆", shortLabel: "Hunt", desc: "Recon & hunting strategy", color: "#aa44ff" },
];

const SYSTEM_PROMPTS = {
  report: `You are an elite bug bounty report writer. Generate a complete, professional HackerOne/Bugcrowd-style report with these sections:

**Summary:** One-line description.
**Vulnerability Type:** (IDOR, XSS, SQLi, SSRF, etc.)
**Severity:** Critical/High/Medium/Low with CVSS justification
**Affected Endpoint:** URL/parameter/component
**Steps to Reproduce:** Numbered precise steps with payloads
**Proof of Concept:** Code block or curl command
**Impact:** Concrete business/data impact
**Remediation:** Clear fix recommendation

Be precise, technical, ruthless with impact clarity. Format with markdown.`,

  attack: `You are a ruthless offensive security mentor. For the given target/feature/vuln class, enumerate attack vectors with surgical precision.

For each vector:
- Attack name
- Why it applies
- Specific payload or test approach
- Success indicator

Be practical, not theoretical. Cover edge cases and chained attacks. Format with markdown.`,

  triage: `You are a seasoned bug bounty hunter crafting triage dispute responses. Write a confident, polite, technically precise response that:
- Acknowledges the triager's point
- Counters with clear technical evidence  
- Re-demonstrates real-world impact
- Proposes fair resolution

Tone: Firm, professional, never emotional. Format with markdown.`,

  hunt: `You are a bug bounty recon and hunting specialist. Provide a structured hunting plan:
- Key attack surface areas
- High-value endpoints to probe
- Common misconfigs for this target type
- Tools and wordlists
- Quick wins vs deep dives
- What most hunters miss

Be specific and actionable. Format with markdown.`,
};

const PLACEHOLDERS = {
  report: "Describe the vulnerability...\n\ne.g., IDOR on /api/v1/user/{id} allows any authenticated user to read other users' PII by changing the ID parameter",
  attack: "Describe the target or feature...\n\ne.g., File upload endpoint that accepts images, converts them server-side, returns a URL",
  triage: "Paste triage response + your finding context...\n\ne.g., They marked my SSRF as informational saying it only hits 169.254.x.x. My finding was...",
  hunt: "Describe your target...\n\ne.g., SaaS project management tool, authenticated scope, React frontend, REST API, AWS infrastructure",
};

function parseMarkdown(text) {
  return text
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="code-block"><code>${code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/^- (.+)$/gm, '<div class="md-li"><span class="md-bullet">▸</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="md-li"><span class="md-bullet md-num">→</span><span>$1</span></div>')
    .replace(/\n\n/g, '<div class="md-spacer"></div>')
    .replace(/\n/g, '<br/>');
}

export default function App() {
  const [mode, setMode] = useState("report");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const outputRef = useRef(null);
  const activeMode = MODES.find(m => m.id === mode);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  async function run() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setOutput("");
    setError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPTS[mode],
          messages: [{ role: "user", content: input }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const result = data.content[0]?.text || "";
      setOutput(result);
      setHistory(h => [{ mode, label: input.slice(0, 50), output: result, time: new Date().toLocaleTimeString() }, ...h.slice(0, 6)]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copyOutput() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; width: 100%; }
        body {
          background: #07080f;
          color: #c8d8ff;
          font-family: 'Rajdhani', sans-serif;
          overflow-x: hidden;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0d0f1a; }
        ::-webkit-scrollbar-thumb { background: #1a2040; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #2a3560; }

        .app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }

        /* BG grid */
        .app::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(30,50,120,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30,50,120,0.07) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 0;
        }

        /* HEADER */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 56px;
          background: rgba(10,12,25,0.95);
          border-bottom: 1px solid #1a2040;
          position: relative;
          z-index: 10;
          flex-shrink: 0;
          backdrop-filter: blur(10px);
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .logo-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #00ff88;
          box-shadow: 0 0 10px #00ff88, 0 0 30px #00ff8840;
          animation: blink 2s infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .logo-text {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.85em;
          color: #00ff88;
          letter-spacing: 0.2em;
        }
        .header-right {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.65em;
          color: #2a3560;
          letter-spacing: 0.1em;
        }

        /* MAIN LAYOUT */
        .main {
          display: flex;
          flex: 1;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        /* SIDEBAR */
        .sidebar {
          width: 240px;
          flex-shrink: 0;
          background: rgba(8,10,20,0.9);
          border-right: 1px solid #1a2040;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          transition: transform 0.3s ease;
        }
        .sidebar-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6em;
          color: #2a3560;
          letter-spacing: 0.2em;
          padding: 16px 16px 8px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          cursor: pointer;
          border-left: 2px solid transparent;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .nav-item:hover { background: rgba(255,255,255,0.02); }
        .nav-item.active { background: rgba(0,255,136,0.04); }
        .nav-icon {
          font-size: 1.1em;
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }
        .nav-text { flex: 1; }
        .nav-title {
          font-size: 0.82em;
          font-weight: 600;
          letter-spacing: 0.05em;
          line-height: 1.2;
        }
        .nav-desc {
          font-size: 0.65em;
          color: #2a3560;
          margin-top: 2px;
          font-family: 'Share Tech Mono', monospace;
        }

        /* History */
        .history-section { margin-top: auto; border-top: 1px solid #0d1025; padding: 8px 0; }
        .history-item {
          padding: 8px 16px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .history-item:hover { background: rgba(255,255,255,0.02); }
        .history-mode { font-size: 0.65em; font-weight: 600; }
        .history-label { font-size: 0.6em; color: #2a3560; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Share Tech Mono', monospace; }
        .history-time { font-size: 0.55em; color: #1a2040; font-family: 'Share Tech Mono', monospace; }

        /* CONTENT */
        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        /* MODE HEADER */
        .mode-header {
          padding: 16px 24px;
          border-bottom: 1px solid #0d1025;
          background: rgba(8,10,20,0.6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .mode-info { display: flex; align-items: center; gap: 12px; }
        .mode-icon-big {
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.3em;
          border-radius: 8px;
          border: 1px solid;
        }
        .mode-title { font-size: 1em; font-weight: 700; letter-spacing: 0.08em; }
        .mode-subtitle { font-size: 0.7em; color: #2a3a5a; font-family: 'Share Tech Mono', monospace; margin-top: 2px; }

        /* PANELS */
        .panels {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          overflow: hidden;
        }

        .panel {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: 1px solid #0d1025;
        }
        .panel:last-child { border-right: none; }

        .panel-header {
          padding: 10px 20px;
          border-bottom: 1px solid #0d1025;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(8,10,20,0.4);
          flex-shrink: 0;
        }
        .panel-title {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6em;
          color: #2a3560;
          letter-spacing: 0.2em;
        }
        .char-count {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6em;
          color: #1a2040;
        }

        /* TEXTAREA */
        textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          padding: 20px;
          color: #c8d8ff;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.82em;
          line-height: 1.7;
          caret-color: #00ff88;
        }
        textarea::placeholder { color: #1a2540; }

        /* EXECUTE BAR */
        .execute-bar {
          padding: 12px 20px;
          border-top: 1px solid #0d1025;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(8,10,20,0.6);
          flex-shrink: 0;
        }
        .hint {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6em;
          color: #1a2540;
        }
        .execute-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 28px;
          border: 1px solid;
          border-radius: 4px;
          cursor: pointer;
          font-family: 'Rajdhani', sans-serif;
          font-size: 0.85em;
          font-weight: 700;
          letter-spacing: 0.15em;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .execute-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .execute-btn:hover::before { opacity: 1; }
        .execute-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* OUTPUT */
        .output-panel { display: flex; flex-direction: column; overflow: hidden; }
        .output-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .output-actions {
          padding: 10px 20px;
          border-top: 1px solid #0d1025;
          display: flex;
          gap: 8px;
          flex-shrink: 0;
          background: rgba(8,10,20,0.4);
        }
        .action-btn {
          padding: 6px 16px;
          border: 1px solid #1a2040;
          background: transparent;
          color: #2a3560;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.65em;
          letter-spacing: 0.1em;
          cursor: pointer;
          border-radius: 3px;
          transition: all 0.15s;
        }
        .action-btn:hover { border-color: #3a4a80; color: #6a80c0; }
        .action-btn.success { border-color: #00ff88; color: #00ff88; }

        /* MARKDOWN STYLES */
        .md-h1 { font-size: 1.1em; font-weight: 700; color: #fff; margin: 16px 0 8px; letter-spacing: 0.05em; }
        .md-h2 { font-size: 0.95em; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #1a2040; }
        .md-h3 { font-size: 0.85em; font-weight: 600; color: #8090d0; margin: 12px 0 4px; font-family: 'Share Tech Mono', monospace; }
        .md-li { display: flex; gap: 8px; margin: 4px 0; line-height: 1.5; font-size: 0.88em; }
        .md-bullet { flex-shrink: 0; margin-top: 1px; }
        .md-spacer { height: 8px; }
        .code-block {
          background: #080a14;
          border: 1px solid #1a2040;
          border-left: 3px solid;
          border-radius: 4px;
          padding: 14px 16px;
          margin: 10px 0;
          overflow-x: auto;
        }
        .code-block code {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.8em;
          line-height: 1.6;
          white-space: pre;
        }
        .inline-code {
          background: #0d1025;
          border: 1px solid #1a2040;
          padding: 1px 6px;
          border-radius: 3px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.82em;
        }

        /* LOADING */
        .loading-wrap { padding: 8px 0; }
        .skeleton {
          height: 10px;
          border-radius: 2px;
          background: linear-gradient(90deg, #0d1025 25%, #1a2040 50%, #0d1025 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          margin: 8px 0;
        }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        /* ERROR */
        .error-box {
          background: rgba(255,40,60,0.05);
          border: 1px solid #3a1020;
          border-left: 3px solid #ff2244;
          padding: 12px 16px;
          border-radius: 4px;
          color: #ff6680;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.78em;
          line-height: 1.5;
        }

        /* EMPTY STATE */
        .empty-state {
          padding: 20px 0;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.72em;
          color: #1a2540;
          line-height: 2.2;
        }

        /* MOBILE HAMBURGER */
        .hamburger {
          display: none;
          background: none;
          border: 1px solid #1a2040;
          color: #3a4a80;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 1em;
          border-radius: 3px;
        }

        /* MOBILE OVERLAY */
        .sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 49;
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .sidebar {
            position: fixed;
            top: 56px;
            left: 0;
            bottom: 0;
            z-index: 50;
            width: 260px;
            transform: translateX(-100%);
          }
          .sidebar.open { transform: translateX(0); }
          .sidebar-overlay { display: block; }
          .hamburger { display: flex; align-items: center; }
          .panels { grid-template-columns: 1fr; }
          .panel { min-height: 45vh; }
          .panel:first-child { border-right: none; border-bottom: 1px solid #0d1025; }
        }

        @media (max-width: 500px) {
          .header { padding: 0 12px; }
          .logo-text { font-size: 0.75em; }
          .mode-header { padding: 12px 16px; }
          .execute-bar { flex-wrap: wrap; gap: 8px; }
          .execute-btn { width: 100%; justify-content: center; }
          textarea { padding: 14px; font-size: 0.78em; }
          .output-scroll { padding: 14px; }
        }
      `}</style>

      <div className="app">
        {/* HEADER */}
        <header className="header">
          <div className="header-left">
            <button className="hamburger" onClick={() => setMenuOpen(o => !o)}>☰</button>
            <div className="logo-dot" />
            <span className="logo-text">BBH // AI ASSISTANT</span>
          </div>
          <div className="header-right">{new Date().toLocaleString()} // ONLINE</div>
        </header>

        <div className="main">
          {/* Overlay for mobile */}
          {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

          {/* SIDEBAR */}
          <aside className={`sidebar${menuOpen ? " open" : ""}`}>
            <div className="sidebar-label">// MODULES</div>
            {MODES.map(m => (
              <div
                key={m.id}
                className={`nav-item${mode === m.id ? " active" : ""}`}
                style={{
                  borderLeftColor: mode === m.id ? m.color : "transparent",
                }}
                onClick={() => { setMode(m.id); setOutput(""); setError(""); setMenuOpen(false); }}
              >
                <span className="nav-icon" style={{ color: mode === m.id ? m.color : "#2a3560" }}>{m.icon}</span>
                <div className="nav-text">
                  <div className="nav-title" style={{ color: mode === m.id ? m.color : "#6070a0" }}>{m.label}</div>
                  <div className="nav-desc">{m.desc}</div>
                </div>
              </div>
            ))}

            {history.length > 0 && (
              <div className="history-section">
                <div className="sidebar-label">// HISTORY</div>
                {history.map((h, i) => {
                  const hMode = MODES.find(m => m.id === h.mode);
                  return (
                    <div key={i} className="history-item" onClick={() => { setMode(h.mode); setOutput(h.output); setMenuOpen(false); }}>
                      <div className="history-mode" style={{ color: hMode?.color }}>{hMode?.icon} {h.mode}</div>
                      <div className="history-label">{h.label}</div>
                      <div className="history-time">{h.time}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* CONTENT */}
          <div className="content">
            {/* MODE HEADER */}
            <div className="mode-header">
              <div className="mode-info">
                <div
                  className="mode-icon-big"
                  style={{
                    color: activeMode.color,
                    borderColor: activeMode.color + "40",
                    background: activeMode.color + "08",
                    boxShadow: `0 0 20px ${activeMode.color}15`,
                  }}
                >
                  {activeMode.icon}
                </div>
                <div>
                  <div className="mode-title" style={{ color: activeMode.color }}>{activeMode.label.toUpperCase()}</div>
                  <div className="mode-subtitle">{activeMode.desc}</div>
                </div>
              </div>
            </div>

            {/* PANELS */}
            <div className="panels">
              {/* INPUT PANEL */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">// INPUT</span>
                  <span className="char-count">{input.length} chars</span>
                </div>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run(); }}
                  placeholder={PLACEHOLDERS[mode]}
                  spellCheck={false}
                />
                <div className="execute-bar">
                  <span className="hint">CTRL+ENTER to execute</span>
                  <button
                    className="execute-btn"
                    disabled={loading || !input.trim()}
                    onClick={run}
                    style={{
                      borderColor: activeMode.color,
                      color: loading ? activeMode.color : "#07080f",
                      background: loading ? "transparent" : activeMode.color,
                      boxShadow: loading ? "none" : `0 0 20px ${activeMode.color}40`,
                    }}
                  >
                    {loading ? (
                      <>
                        <span style={{ display: "inline-block", animation: "blink 1s infinite" }}>■</span>
                        PROCESSING
                      </>
                    ) : (
                      <>▶ EXECUTE</>
                    )}
                  </button>
                </div>
              </div>

              {/* OUTPUT PANEL */}
              <div className="panel output-panel">
                <div className="panel-header">
                  <span className="panel-title">// OUTPUT</span>
                  {output && <span className="char-count">{output.length} chars</span>}
                </div>

                <div className="output-scroll" ref={outputRef}>
                  {error && <div className="error-box">ERROR: {error}</div>}

                  {loading && (
                    <div className="loading-wrap">
                      {[75, 55, 85, 45, 70, 60, 80].map((w, i) => (
                        <div key={i} className="skeleton" style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }} />
                      ))}
                    </div>
                  )}

                  {output && !loading && (
                    <div
                      style={{ fontSize: "0.88em", lineHeight: 1.7 }}
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(output) }}
                    />
                  )}

                  {!output && !loading && !error && (
                    <div className="empty-state">
                      <div>// Awaiting input.</div>
                      <div>// Mode: {mode.toUpperCase()}</div>
                      <div>// {activeMode.desc}</div>
                      <div>// Ctrl+Enter to execute.</div>
                    </div>
                  )}
                </div>

                {output && (
                  <div className="output-actions">
                    <button className={`action-btn${copied ? " success" : ""}`} onClick={copyOutput}>
                      {copied ? "✓ COPIED" : "◈ COPY"}
                    </button>
                    <button className="action-btn" onClick={() => setOutput("")}>✕ CLEAR</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
