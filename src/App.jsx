import { useState, useRef, useEffect } from "react";
 
const MODES = [
  { id: "report", label: "Report Writer", icon: "◈", desc: "Generate structured vuln reports" },
  { id: "attack", label: "Attack Vectors", icon: "⬡", desc: "Brainstorm exploitation approaches" },
  { id: "triage", label: "Triage Response", icon: "◎", desc: "Craft dispute & negotiation replies" },
  { id: "hunt", label: "Hunt Tips", icon: "◆", desc: "Target-specific recon & hunting" },
];
 
const SYSTEM_PROMPTS = {
  report: `You are an elite bug bounty report writer. When given a vulnerability description, generate a complete, professional HackerOne/Bugcrowd-style report with these exact sections:
 
**Summary:** One-line description of the vulnerability.
**Vulnerability Type:** (e.g., IDOR, XSS, SQLi, SSRF, etc.)
**Severity:** (Critical/High/Medium/Low with brief CVSS justification)
**Affected Endpoint:** URL/parameter/component
**Steps to Reproduce:** Numbered, precise steps with example payloads
**Proof of Concept:** Code block or curl command
**Impact:** Concrete business/data impact (be specific, no fluff)
**Remediation:** Clear fix recommendation
 
Be precise, technical, and ruthless with impact clarity. No fluff. Format with markdown.`,
 
  attack: `You are a ruthless offensive security mentor for bug bounty hunters. When given a target, feature, or vulnerability class, enumerate attack vectors with surgical precision.
 
For each vector provide:
- Attack name
- Why it applies here
- Specific payload or test approach
- What to look for as a success indicator
 
Be practical, not theoretical. Think like an attacker, not a textbook. Cover edge cases and chained attacks. Format with markdown.`,
 
  triage: `You are a seasoned bug bounty hunter helping craft professional triage dispute responses. When given context about a finding being downgraded, closed, or disputed — write a confident, polite, technically precise response that:
 
- Acknowledges the triager's point
- Counters with clear technical evidence
- Re-demonstrates real-world impact
- Proposes a fair resolution
 
Tone: Firm, professional, never emotional. Format with markdown.`,
 
  hunt: `You are a bug bounty recon and hunting specialist. When given a target (domain, app type, feature, or scope), provide a structured hunting plan:
 
- Key attack surface areas to focus on
- High-value endpoints to probe
- Common misconfigs for this target type
- Tools and wordlists to use
- Quick wins vs deep dives
- What most hunters miss
 
Be specific and actionable. No generic advice. Format with markdown.`,
};
 
const PLACEHOLDERS = {
  report: "Describe the vulnerability... e.g., 'IDOR on /api/v1/user/{id} allows any authenticated user to read other users' PII by changing the ID parameter'",
  attack: "Describe the target or feature... e.g., 'File upload endpoint that accepts images, converts them server-side, returns a URL'",
  triage: "Paste the triage response + your finding context... e.g., 'They marked my SSRF as informational saying it only hits internal IP 169.254.x.x. My finding: ...'",
  hunt: "Describe your target... e.g., 'SaaS project management tool, authenticated scope, React frontend, REST API, AWS infrastructure'",
};
 
function MarkdownRenderer({ content }) {
  const formatted = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#0f1a0f;border:1px solid #1a4d1a;padding:2px 6px;border-radius:3px;font-family:monospace;font-size:0.85em;color:#4dff91">$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#0a120a;border:1px solid #1a4d1a;border-left:3px solid #00cc44;padding:12px 16px;border-radius:4px;overflow-x:auto;margin:8px 0"><code style="font-family:\'Courier New\',monospace;font-size:0.82em;color:#4dff91;white-space:pre">$1</code></pre>')
    .replace(/^### (.+)$/gm, '<h3 style="color:#00cc44;font-size:0.9em;text-transform:uppercase;letter-spacing:0.1em;margin:16px 0 6px;font-family:monospace">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#00ff55;font-size:1em;text-transform:uppercase;letter-spacing:0.12em;margin:20px 0 8px;font-family:monospace;border-bottom:1px solid #1a4d1a;padding-bottom:4px">$1</h2>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#00cc44;flex-shrink:0">▸</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, (m, p1, offset, str) => {
      const num = str.slice(0, offset).match(/^\d+\. /gm)?.length + 1 || 1;
      return `<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#00cc44;flex-shrink:0;min-width:20px">${num}.</span><span>${p1}</span></div>`;
    })
    .split('\n').map(line => line.trim() === '' ? '<br/>' : line).join('\n');
 
  return (
    <div
      style={{ lineHeight: 1.7, color: '#b3ffcc', fontSize: '0.9em' }}
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
}
 
export default function BugBountyAssistant() {
  const [mode, setMode] = useState("report");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const outputRef = useRef(null);
  const textareaRef = useRef(null);
 
  useEffect(() => {
    if (output && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);
 
  async function run() {
    if (!input.trim()) return;
    setLoading(true);
    setOutput("");
    setError("");
 
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPTS[mode],
          messages: [{ role: "user", content: input }],
        }),
      });
 
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const result = data.content[0]?.text || "";
      setOutput(result);
      setHistory(h => [{ mode, input: input.slice(0, 60) + (input.length > 60 ? "..." : ""), output: result, time: new Date().toLocaleTimeString() }, ...h.slice(0, 4)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
 
  function handleKey(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
  }
 
  return (
    <div style={{
      minHeight: "100vh",
      background: "#050d05",
      color: "#b3ffcc",
      fontFamily: "'Courier New', monospace",
      padding: "0",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,70,0.015) 2px, rgba(0,255,70,0.015) 4px)",
      }} />
 
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1a4d1a",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(0,20,0,0.8)",
        position: "relative", zIndex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", background: "#00ff55",
            boxShadow: "0 0 8px #00ff55, 0 0 20px #00ff5540",
            animation: "pulse 2s infinite",
          }} />
          <span style={{ fontSize: "0.75em", letterSpacing: "0.25em", color: "#00cc44", textTransform: "uppercase" }}>
            BBH // AI Assistant
          </span>
        </div>
        <div style={{ fontSize: "0.65em", color: "#1a6b1a", letterSpacing: "0.15em" }}>
          {new Date().toLocaleString()} // ACTIVE
        </div>
      </div>
 
      <div style={{ display: "flex", flex: 1, position: "relative", zIndex: 1 }}>
        {/* Sidebar */}
        <div style={{
          width: 220, borderRight: "1px solid #1a4d1a",
          background: "rgba(0,10,0,0.6)",
          padding: "20px 0",
          flexShrink: 0,
        }}>
          <div style={{ padding: "0 16px 16px", fontSize: "0.6em", color: "#1a6b1a", letterSpacing: "0.2em" }}>
            // MODULES
          </div>
          {MODES.map(m => (
            <div
              key={m.id}
              onClick={() => { setMode(m.id); setOutput(""); setError(""); }}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                borderLeft: mode === m.id ? "2px solid #00ff55" : "2px solid transparent",
                background: mode === m.id ? "rgba(0,255,85,0.06)" : "transparent",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ color: mode === m.id ? "#00ff55" : "#1a6b1a", fontSize: "1.1em" }}>{m.icon}</span>
                <span style={{ fontSize: "0.78em", color: mode === m.id ? "#00ff55" : "#4d8c4d", fontWeight: mode === m.id ? "bold" : "normal", letterSpacing: "0.05em" }}>
                  {m.label}
                </span>
              </div>
              <div style={{ fontSize: "0.65em", color: "#1a5a1a", paddingLeft: 22 }}>{m.desc}</div>
            </div>
          ))}
 
          {/* History */}
          {history.length > 0 && (
            <div style={{ marginTop: 32, borderTop: "1px solid #0f2a0f", paddingTop: 16 }}>
              <div style={{ padding: "0 16px 10px", fontSize: "0.6em", color: "#1a6b1a", letterSpacing: "0.2em" }}>
                // HISTORY
              </div>
              {history.map((h, i) => (
                <div
                  key={i}
                  onClick={() => { setMode(h.mode); setOutput(h.output); setInput(""); }}
                  style={{
                    padding: "8px 16px", cursor: "pointer",
                    borderLeft: "2px solid transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderLeftColor = "#1a4d1a"}
                  onMouseLeave={e => e.currentTarget.style.borderLeftColor = "transparent"}
                >
                  <div style={{ fontSize: "0.65em", color: "#00cc44" }}>{MODES.find(m => m.id === h.mode)?.icon} {h.mode}</div>
                  <div style={{ fontSize: "0.6em", color: "#1a5a1a", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.input}</div>
                  <div style={{ fontSize: "0.55em", color: "#0f3a0f" }}>{h.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>
 
        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Mode header */}
          <div style={{
            padding: "16px 24px", borderBottom: "1px solid #0f2a0f",
            background: "rgba(0,15,0,0.4)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: "1.4em", color: "#00ff55" }}>{MODES.find(m => m.id === mode)?.icon}</span>
            <div>
              <div style={{ fontSize: "0.8em", color: "#00ff55", letterSpacing: "0.1em", fontWeight: "bold" }}>
                {MODES.find(m => m.id === mode)?.label.toUpperCase()}
              </div>
              <div style={{ fontSize: "0.65em", color: "#1a6b1a" }}>{MODES.find(m => m.id === mode)?.desc}</div>
            </div>
          </div>
 
          {/* Input area */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #0f2a0f" }}>
            <div style={{ marginBottom: 6, fontSize: "0.6em", color: "#1a6b1a", letterSpacing: "0.15em" }}>
              // INPUT — CTRL+ENTER TO EXECUTE
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={PLACEHOLDERS[mode]}
              rows={5}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#060f06", border: "1px solid #1a4d1a",
                borderRadius: 4, padding: "12px 14px",
                color: "#b3ffcc", fontFamily: "'Courier New', monospace",
                fontSize: "0.82em", lineHeight: 1.6, resize: "vertical",
                outline: "none", caretColor: "#00ff55",
              }}
              onFocus={e => e.target.style.borderColor = "#00cc44"}
              onBlur={e => e.target.style.borderColor = "#1a4d1a"}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <div style={{ fontSize: "0.6em", color: "#0f3a0f" }}>
                {input.length} chars
              </div>
              <button
                onClick={run}
                disabled={loading || !input.trim()}
                style={{
                  background: loading ? "transparent" : "#00ff55",
                  border: "1px solid #00ff55",
                  color: loading ? "#00ff55" : "#050d05",
                  padding: "8px 24px", cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "'Courier New', monospace", fontSize: "0.75em",
                  fontWeight: "bold", letterSpacing: "0.15em",
                  borderRadius: 3, transition: "all 0.15s",
                  opacity: (!input.trim() && !loading) ? 0.4 : 1,
                }}
              >
                {loading ? "PROCESSING..." : "▶ EXECUTE"}
              </button>
            </div>
          </div>
 
          {/* Output area */}
          <div
            ref={outputRef}
            style={{
              flex: 1, overflow: "auto", padding: "20px 24px",
              background: "#050d05",
            }}
          >
            {error && (
              <div style={{
                background: "rgba(255,0,0,0.05)", border: "1px solid #4d0000",
                borderLeft: "3px solid #ff3333", padding: "12px 16px", borderRadius: 4,
                color: "#ff6666", fontSize: "0.82em",
              }}>
                ERROR: {error}
              </div>
            )}
 
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
                {[80, 65, 90, 50, 75].map((w, i) => (
                  <div key={i} style={{
                    height: 8, width: `${w}%`, borderRadius: 2,
                    background: "linear-gradient(90deg, #0f2a0f, #1a4d1a, #0f2a0f)",
                    backgroundSize: "200% 100%",
                    animation: `shimmer 1.5s ${i * 0.1}s infinite`,
                  }} />
                ))}
              </div>
            )}
 
            {output && !loading && (
              <div>
                <div style={{ marginBottom: 16, fontSize: "0.6em", color: "#1a6b1a", letterSpacing: "0.15em" }}>
                  // OUTPUT — {new Date().toLocaleTimeString()}
                </div>
                <MarkdownRenderer content={output} />
                <button
                  onClick={() => navigator.clipboard.writeText(output)}
                  style={{
                    marginTop: 20, background: "transparent",
                    border: "1px solid #1a4d1a", color: "#1a6b1a",
                    padding: "6px 16px", cursor: "pointer",
                    fontFamily: "'Courier New', monospace", fontSize: "0.65em",
                    letterSpacing: "0.1em", borderRadius: 3,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = "#00cc44"; e.target.style.color = "#00cc44"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "#1a4d1a"; e.target.style.color = "#1a6b1a"; }}
                >
                  ◈ COPY OUTPUT
                </button>
              </div>
            )}
 
            {!output && !loading && !error && (
              <div style={{ paddingTop: 20, opacity: 0.4 }}>
                <div style={{ fontSize: "0.65em", color: "#1a5a1a", lineHeight: 2 }}>
                  {[
                    "// Ready for input.",
                    `// Mode: ${mode.toUpperCase()}`,
                    "// Describe your target, vuln, or situation.",
                    "// Ctrl+Enter to execute.",
                  ].map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
 
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #050d05; }
        ::-webkit-scrollbar-thumb { background: #1a4d1a; border-radius: 2px; }
        textarea::placeholder { color: #1a4d1a; }
      `}</style>
    </div>
  );
}
