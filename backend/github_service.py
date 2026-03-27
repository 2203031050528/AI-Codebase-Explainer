import requests

def parse_github_url(url: str):
    url = url.strip()
    if url.endswith("/"):
        url = url[:-1]
    if url.endswith(".git"):
        url = url[:-4]
    
    parts = url.split("/")
    owner = parts[-2]
    repo = parts[-1]
    return owner, repo
import os
from dotenv import load_dotenv

load_dotenv()

def _headers():
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        return {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
    return {"Accept": "application/vnd.github.v3+json"}

def get_repo_contents(owner, repo, path=""):
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    res = requests.get(url, headers=_headers())

    if res.status_code != 200:
        return []

    data = res.json()
    # GitHub returns a dict (not list) for single files — guard against that
    return data if isinstance(data, list) else []



import base64

def get_file_content(owner, repo, path):
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    res = requests.get(url, headers=_headers())

    if res.status_code != 200:
        return ""

    data = res.json()
    if not isinstance(data, dict):
        return ""

    if data.get("encoding") == "base64":
        try:
            content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return content
        except Exception:
            return ""

    return ""


import re

def extract_imports(code):
    imports = []

    # ES6 imports
    matches = re.findall(r'import .* from [\'"](.*)[\'"]', code)
    imports.extend(matches)

    # CommonJS require
    matches = re.findall(r'require\([\'"](.*)[\'"]\)', code)
    imports.extend(matches)

    return imports    