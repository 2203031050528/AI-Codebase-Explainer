import { useState, useCallback } from "react";
import axios from "axios";
import GraphView from "./GraphView";

const API = "http://127.0.0.1:8000";

/* ─── FileTree ─────────────────────────────────────────────────────── */
function FileTree({ repoUrl, item, onFileClick, activeFile }) {
  const [children, setChildren] = useState(null);
  const [isOpen, setIsOpen]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const toggle = async () => {
    if (isOpen) { setIsOpen(false); return; }
    if (!children) {
      setLoading(true);
      try {
        const res = await axios.post(`${API}/repo`, { repo_url: repoUrl, path: item.path });
        setChildren(res.data);
      } catch {}
      setLoading(false);
    }
    setIsOpen(true);
  };

  if (item.type === "file") {
    return (
      <li
        className={`tree-item${activeFile === item.path ? " active" : ""}`}
        onClick={() => onFileClick(item.path)}
      >
        <span className="icon">📄</span>
        {item.name}
      </li>
    );
  }

  return (
    <div>
      <div className="tree-item folder" onClick={toggle}>
        <span className="icon">{isOpen ? "📂" : "📁"}</span>
        {item.name}
      </div>
      {loading && <div className="tree-loading">Loading…</div>}
      {isOpen && children && (
        <div className="tree-children">
          {children.map(c => (
            <FileTree key={c.path} repoUrl={repoUrl} item={c} onFileClick={onFileClick} activeFile={activeFile} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Spinner ──────────────────────────────────────────────────────── */
const Spinner = () => <span className="spinner" />;

/* ─── Main App ─────────────────────────────────────────────────────── */
export default function App() {
  const [repo, setRepo]               = useState("");
  const [files, setFiles]             = useState([]);
  const [activeFile, setActiveFile]   = useState("");
  const [code, setCode]               = useState("");
  const [explanation, setExplanation] = useState("");
  const [complexity, setComplexity]   = useState(null);
  const [question, setQuestion]       = useState("");
  const [answer, setAnswer]           = useState("");
  const [graph, setGraph]             = useState({ nodes: [], edges: [] });
  const [activeTab, setActiveTab]     = useState("explain");
  const [loadingRepo,     setLoadingRepo]     = useState(false);
  const [loadingExplain,  setLoadingExplain]  = useState(false);
  const [loadingAsk,      setLoadingAsk]      = useState(false);
  const [loadingGraph,    setLoadingGraph]    = useState(false);
  const [loadingSummary,  setLoadingSummary]  = useState(false);

  /* helpers ─────────────────────────────────────────────────────────── */
  const getComplexity = (src) => {
    const lines = src.split("\n").length;
    const funcs = (src.match(/\bdef |function |const .* = .*(=>|function)/g) || []).length;
    return { lines, funcs };
  };

  /* Recursively fetch ALL file paths from every folder in the repo */
  const fetchAllFiles = useCallback(async (items, repoUrl, collected = []) => {
    for (const item of items) {
      if (item.type === "file") {
        collected.push(item.path);
      } else if (item.type === "dir") {
        try {
          const res = await axios.post(`${API}/repo`, { repo_url: repoUrl, path: item.path });
          await fetchAllFiles(res.data, repoUrl, collected);
        } catch {}
      }
    }
    return collected;
  }, []);

  /* Fetch repo ──────────────────────────────────────────────────────── */
  const fetchRepo = async () => {
    if (!repo.trim()) return;
    setLoadingRepo(true);
    setFiles([]); setCode(""); setExplanation(""); setAnswer(""); setGraph({ nodes: [], edges: [] });
    try {
      const res = await axios.post(`${API}/repo`, { repo_url: repo });
      setFiles(res.data);
    } catch (e) { console.error(e); }
    setLoadingRepo(false);
  };

  /* Fetch + explain file ─────────────────────────────────────────────── */
  const fetchFile = async (path) => {
    setActiveFile(path);
    setCode(""); setExplanation(""); setComplexity(null);
    setLoadingExplain(true);
    setActiveTab("explain");
    try {
      const fileRes = await axios.post(`${API}/file`, { repo_url: repo, path });
      const src = fileRes.data.content || "";
      setCode(src);
      setComplexity(getComplexity(src));

      const explRes = await axios.post(`${API}/explain`, { code: src });
      setExplanation(explRes.data.explanation || "");
    } catch (e) { console.error(e); setExplanation("Error fetching explanation."); }
    setLoadingExplain(false);
  };

  /* Ask AI ──────────────────────────────────────────────────────────── */
  const askAI = async () => {
    if (!question.trim()) return;
    setLoadingAsk(true); setAnswer("");
    try {
      const res = await axios.post(`${API}/ask`, { question, code });
      setAnswer(res.data.answer || "");
    } catch (e) { setAnswer("Error communicating with AI."); }
    setLoadingAsk(false);
  };

  /* Generate graph: recursively collect ALL files, then build graph */
  const generateGraph = async () => {
    if (!files.length) return;
    setLoadingGraph(true); setActiveTab("graph");
    try {
      // Traverse every folder to get all file paths
      const allPaths = await fetchAllFiles(files, repo);
      // Limit to 40 files max to keep the graph readable
      const paths = allPaths.slice(0, 40);
      if (!paths.length) return;
      const res = await axios.post(`${API}/graph`, { repo_url: repo, files: paths });
      setGraph(res.data);
    } catch (e) { console.error(e); }
    setLoadingGraph(false);
  };

  /* Collect all file paths from the (already-loaded) tree ─────────── */
  const collectFiles = (items, collected = []) => {
    for (const item of items) {
      if (item.type === "file") collected.push(item.path);
      else if (item.children) collectFiles(item.children, collected);
    }
    return collected;
  };

  /* Summarize repo ─────────────────────────────────────────────────── */
  const summarizeRepo = async () => {
    if (!files.length) return;
    setLoadingSummary(true); setActiveTab("explain"); setExplanation(""); setActiveFile("(Repository Summary)");
    const paths = collectFiles(files).slice(0, 8);
    try {
      const snippets = await Promise.all(
        paths.map(p => axios.post(`${API}/file`, { repo_url: repo, path: p }).then(r => `// ${p}\n${(r.data.content||"").slice(0, 500)}`))
      );
      const combined = snippets.join("\n\n---\n\n");
      const explRes = await axios.post(`${API}/explain`, {
        code: `Give a high-level overview of this project based on these file snippets:\n\n${combined}`
      });
      setExplanation(explRes.data.explanation || "");
    } catch (e) { setExplanation("Error summarizing repo."); }
    setLoadingSummary(false);
  };

  /* Copy code ─────────────────────────────────────────────────────── */
  const copyCode = () => { if (code) navigator.clipboard.writeText(code); };

  /* Key handler for Ask AI ─────────────────────────────────────────── */
  const onKeyDown = (e) => { if (e.key === "Enter") askAI(); };

  /* ─── Render ────────────────────────────────────────────────────── */
  return (
    <div className="app-shell">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-logo">
          ⚡ <span>CodeLens</span>
        </div>
        <div className="header-divider" />
        <input
          className="repo-input"
          type="text"
          placeholder="Paste a GitHub repo URL…"
          value={repo}
          onChange={e => setRepo(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchRepo()}
        />
        <button className="btn btn-primary" onClick={fetchRepo} disabled={loadingRepo}>
          {loadingRepo ? <Spinner /> : "Analyze"}
        </button>
        <button className="btn btn-ghost" onClick={summarizeRepo} disabled={!files.length || loadingSummary} title="AI summary of the whole repo">
          {loadingSummary ? <Spinner /> : "📋 Summarize"}
        </button>
        <button className="btn btn-ghost" onClick={generateGraph} disabled={!files.length || loadingGraph} title="Generate import graph">
          {loadingGraph ? <Spinner /> : "🕸 Graph"}
        </button>
      </header>

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-title">Explorer</div>
        {files.length === 0 ? (
          <div className="sidebar-empty">Enter a repo URL to explore files</div>
        ) : (
          <ul className="file-tree">
            {files.map(f => (
              <FileTree key={f.path} repoUrl={repo} item={f} onFileClick={fetchFile} activeFile={activeFile} />
            ))}
          </ul>
        )}
      </aside>

      {/* ── Editor ── */}
      <main className="editor-panel">
        <div className="editor-topbar">
          <span className="editor-filepath mono">{activeFile || "No file selected"}</span>
          {code && (
            <button className="btn btn-ghost btn-sm" onClick={copyCode}>Copy</button>
          )}
        </div>
        <div className="editor-scroll">
          {code ? (
            <pre className="code-block">{code}</pre>
          ) : (
            <div className="editor-empty">
              <div className="editor-empty-icon">🗂️</div>
              <p>Click a file in the Explorer to view its source</p>
            </div>
          )}
        </div>
      </main>

      {/* ── AI Panel ── */}
      <aside className="ai-panel">
        <div className="tabs">
          {[["explain","🧠 Explain"], ["ask","💬 Ask AI"], ["graph","🕸 Graph"]].map(([id, label]) => (
            <button key={id} className={`tab${activeTab === id ? " active" : ""}`} onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="tab-content">

          {/* Explain tab */}
          {activeTab === "explain" && (
            <>
              {complexity && (
                <>
                  <div className="section-label">Complexity</div>
                  <div className="complexity-row">
                    <div className="complexity-card">
                      <div className="num">{complexity.lines}</div>
                      <div className="label">Lines</div>
                    </div>
                    <div className="complexity-card">
                      <div className="num">{complexity.funcs}</div>
                      <div className="label">Functions</div>
                    </div>
                  </div>
                </>
              )}
              <div className="section-label">AI Explanation</div>
              <div className={`ai-output${loadingExplain ? " loading" : ""}${!explanation && !loadingExplain ? " empty" : ""}`}>
                {loadingExplain ? "Analyzing with llama3…" : explanation || "Select a file to get an AI explanation."}
              </div>
            </>
          )}

          {/* Ask AI tab */}
          {activeTab === "ask" && (
            <>
              <div className="section-label">Ask about the code</div>
              <div className="ask-bar">
                <input
                  className="ask-input"
                  type="text"
                  placeholder="e.g. What does this function do?"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={onKeyDown}
                />
                <button className="btn btn-primary" onClick={askAI} disabled={loadingAsk}>
                  {loadingAsk ? <Spinner /> : "Ask"}
                </button>
              </div>
              <div className={`ai-output${loadingAsk ? " loading" : ""}${!answer && !loadingAsk ? " empty" : ""}`}>
                {loadingAsk ? "Thinking…" : answer || "Ask a question about any open file."}
              </div>
            </>
          )}

          {/* Graph tab */}
          {activeTab === "graph" && (
            <>
              <div className="section-label" style={{ marginBottom: 12 }}>Import Dependency Graph</div>
              <div style={{ height: "calc(100vh - 180px)" }}>
                <GraphView nodes={graph.nodes} edges={graph.edges} />
              </div>
            </>
          )}

        </div>
      </aside>

      {/* ── Status Bar ── */}
      <footer className="status-bar">
        <span>{activeFile || "CodeLens — AI Codebase Explainer"}</span>
        <span>llama3:8b · Ollama</span>
      </footer>
    </div>
  );
}