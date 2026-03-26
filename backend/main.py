from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from github_service import parse_github_url, get_repo_contents

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RepoRequest(BaseModel):
    repo_url: str

@app.post("/repo")
def fetch_repo(data: RepoRequest):
    owner, repo = parse_github_url(data.repo_url)
    contents = get_repo_contents(owner, repo)
    return contents


class FileRequest(BaseModel):
    repo_url: str
    path: str


@app.post("/file")
def fetch_file(data: FileRequest):
    owner, repo = parse_github_url(data.repo_url)
    content = get_file_content(owner, repo, data.path)
    return {"content": content}    