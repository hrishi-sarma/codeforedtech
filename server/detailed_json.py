import json
from groq import Groq

# -----------------------
# 1) Load Structured Resume JSON
# -----------------------
with open("json2.json", "r", encoding='utf-8') as f:
    structured_resume = json.load(f)

# -----------------------
# 2) Setup Groq Client
# -----------------------
client = Groq(api_key="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")
SUMMARY_MODEL = "openai/gpt-oss-20b"  # Or mistral-7b-instruct if you prefer faster response

# -----------------------
# 3) Helper to call Groq
# -----------------------
def call_groq(model, prompt, max_tokens=2000, temperature=0.4):
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert professional resume summarizer."},
            {"role": "user", "content": prompt}
        ],
        temperature=temperature,
        max_tokens=max_tokens
    )
    return completion.choices[0].message.content.strip()

# -----------------------
# 4) Summarization Step
# -----------------------
def summarize_section(section_name, section_content):
    """
    Given a section name and its content (could be dict/list/str),
    produce a detailed narrative description of that section.
    """
    pretty_content = json.dumps(section_content, indent=2, ensure_ascii=False)

    prompt = f"""
You are writing a very detailed professional narrative about a candidate's resume section.

Task:
- Read the section carefully.
- Produce a single, well-written paragraph (or two if needed) that captures ALL important details.
- Mention company names, roles, responsibilities, technologies, achievements, and skills explicitly.
- Avoid copying text verbatim; rewrite in a natural, professional tone.
- "Keep dates in the text (e.g., 'Mar 2024 to May 2025'), also write them in words (e.g., 'from March 2024 to May 2025'), and calculate the duration between them (e.g., 'roughly 15 months'). Remove other standalone numbers and percentages, and instead describe them in words (e.g., 'worked for a few months', 'achieved significant improvement')."
- Keep it comprehensive but smooth and readable.
- Do not add information that is not present.

Section: {section_name}
Content:
{pretty_content}
"""

    return call_groq(SUMMARY_MODEL, prompt, max_tokens=1000, temperature=0.5)

# -----------------------
# 5) Generate New JSON
# -----------------------
detailed_resume = {}

for section, content in structured_resume.items():
    print(f"Generating detailed description for section: {section}...")
    detailed_resume[section] = summarize_section(section, content)

# -----------------------
# 6) Save Output
# -----------------------
with open("json3.json", "w", encoding='utf-8') as f: 
    json.dump(detailed_resume, f, indent=2, ensure_ascii=False)

print("\n New detailed resume JSON saved as json3.json")