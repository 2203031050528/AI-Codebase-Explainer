import requests

def parse_github_url(url: str):
    parts = url.strip().split("/")
    owner = parts[-2]
    repo = parts[-1]
    return owner, repo


def get_repo_contents(owner, repo, path=""):
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    res = requests.get(url)
    
    if res.status_code != 200:
        return []

    return res.json()


import base64

def get_file_content(owner, repo, path):
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    res = requests.get(url)

    if res.status_code != 200:
        return {"error": "File not found"}

    data = res.json()

    if data.get("encoding") == "base64":
        content = base64.b64decode(data["content"]).decode("utf-8")
        return content

    return ""    