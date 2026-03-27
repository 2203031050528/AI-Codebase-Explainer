from typing import Optional

import ollama
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from github_service import extract_imports, get_file_content, get_repo_contents, parse_github_url
from vector_service import search_code, store_code

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RepoRequest(BaseModel):
    repo_url: str
    path: Optional[str] = ""


class FileRequest(BaseModel):
    repo_url: str
    path: str


class ExplainRequest(BaseModel):
    code: str


class AskRequest(BaseModel):
    question: str
    code: str = ""


class GraphRequest(BaseModel):
    repo_url: str
    files: list  # list of file paths


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ollama_chat(prompt: str) -> str:
    """Send a prompt to the local Ollama llama3 model and return the text."""
    try:
        response = ollama.chat(
            model="llama3:8b",
            messages=[{"role": "user", "content": prompt}],
        )
        return response["message"]["content"]
    except Exception as e:
        return f"Error communicating with Ollama: {str(e)}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/repo")
def fetch_repo(data: RepoRequest):
    owner, repo = parse_github_url(data.repo_url)
    contents = get_repo_contents(owner, repo, data.path)
    return contents


@app.post("/file")
def fetch_file(data: FileRequest):
    owner, repo = parse_github_url(data.repo_url)
    content = get_file_content(owner, repo, data.path)

    if content:
        store_code(data.path, content)

    return {"content": content}


@app.post("/explain")
def explain(data: ExplainRequest):
    prompt = f"Explain this code in simple terms:\n{data.code[:5000]}"
    return {"explanation": _ollama_chat(prompt)}


@app.post("/ask")
def ask_question(data: AskRequest):
    if data.code:
        # Code context provided directly from the selected file
        context = data.code[:5000]
    else:
        # Fall back to vector search
        chunks = search_code(data.question)
        context = "\n\n".join([chunk for sublist in chunks for chunk in sublist])

    prompt = f"""Answer the question based on the code context below.

Code Context:
{context}

Question:
{data.question}
"""
    return {"answer": _ollama_chat(prompt)}


@app.post("/graph")
def generate_graph(data: GraphRequest):
    owner, repo = parse_github_url(data.repo_url)

    nodes = []
    edges = []

    for file in data.files:
        content = get_file_content(owner, repo, file)

        if not content:
            continue

        nodes.append({"id": file, "label": file})

        imports = extract_imports(content)
        for imp in imports:
            edges.append({"source": file, "target": imp})

    return {"nodes": nodes, "edges": edges}


@app.post("/summarize")
def summarize_code(data: ExplainRequest):
    prompt = f"Summarize the following code:\n{data.code[:5000]}"
    return {"summary": _ollama_chat(prompt)}


@app.post("/complexity")
def analyze_complexity(data: ExplainRequest):
    prompt = f"Analyze the time and space complexity of the following code:\n{data.code[:5000]}"
    return {"complexity_analysis": _ollama_chat(prompt)}