import os
from google import genai

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Load API key from environment variable
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Warning: GEMINI_API_KEY environment variable not set")

client = genai.Client(
    api_key=api_key,
    http_options={"api_version": "v1"},
)

def generate_text(prompt: str) -> str:
    """Generic text generation function handling API calls."""
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        return f"Error analyzing content: {str(e)}"

def explain_code(code: str) -> str:
    prompt = f"""
    Explain the following code:
    - Purpose
    - Logic
    
    Code:
    {code}
    """
    return generate_text(prompt)
