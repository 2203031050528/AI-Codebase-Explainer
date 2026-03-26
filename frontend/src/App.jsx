import { useState } from "react";
import axios from "axios";

function App() {
  const [repo, setRepo] = useState("");
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [code, setCode] = useState("");

  const fetchRepo = async () => {
    const res = await axios.post("http://127.0.0.1:8000/repo", {
      repo_url: repo,
    });
    setFiles(res.data);
  };

  const fetchFileContent = async (path) => {
    setSelectedFile(path);

    const res = await axios.post("http://127.0.0.1:8000/file", {
      repo_url: repo,
      path: path,
    });

    setCode(res.data.content);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>AI Codebase Explainer 🚀</h1>

      <input
        type="text"
        placeholder="Enter GitHub Repo URL"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        style={{ width: "400px", padding: "10px" }}
      />

      <button onClick={fetchRepo} style={{ marginLeft: "10px", padding: "10px" }}>
        Analyze
      </button>

      <ul>
        {files.map((file) => (
          <li
            key={file.path}
            onClick={() =>
              file.type === "file" && fetchFileContent(file.path)
            }
            style={{ cursor: "pointer" }}
          >
            {file.type === "dir" ? "📁" : "📄"} {file.name}
          </li>
        ))}
      </ul>

      {selectedFile && (
        <div style={{ marginTop: "20px" }}>
          <h3>{selectedFile}</h3>
          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: "10px",
              overflowX: "auto",
              maxHeight: "400px",
            }}
          >
            {code}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;