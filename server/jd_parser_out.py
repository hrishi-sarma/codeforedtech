import os
import json
import tempfile
from datetime import datetime
import requests
from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware  # Added CORS import
from docx import Document
from PyPDF2 import PdfReader
from groq import Groq  # pip install groq
from jsonschema import validate, ValidationError  # pip install jsonschema
from supabase import create_client, Client

# -------------------------------
# 1. Configure Supabase
# -------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iplkewjfgukcflkajmzz.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbGtld2pmZ3VrY2Zsa2FqbXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDM1NjMsImV4cCI6MjA3Mzg3OTU2M30.Uu8odziaWjN9aKCmVF2klXAip3Y8woJ6t66XztYQuD0")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -------------------------------
# 2. FastAPI App with CORS
# -------------------------------
app = FastAPI(
    title="Job Description Parser",
    description="API for processing job description documents",
    version="1.0.0"
)

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3001",
        # Add more origins if needed
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# 3. Health Check Endpoint
# -------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint to verify server is running"""
    return {
        "status": "healthy",
        "message": "FastAPI Job Description Parser is running",
        "timestamp": datetime.utcnow().isoformat()
    }

# -------------------------------
# 4. Root Endpoint
# -------------------------------
@app.get("/")
async def root():
    """Root endpoint with basic info"""
    return {
        "message": "Job Description Parser API",
        "docs": "/docs",
        "health": "/health",
        "update_job": "/update_job"
    }

# -------------------------------
# 5. Extract Text from PDF/DOCX
# -------------------------------
def extract_text_from_file(file_path):
    """Extracts text from PDF or DOCX file."""
    if file_path.lower().endswith(".pdf"):
        reader = PdfReader(file_path)
        text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
    elif file_path.lower().endswith(".docx"):
        doc = Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs])
    else:
        raise ValueError("Unsupported file format. Please provide a PDF or DOCX.")
    return text.strip()

# -------------------------------
# 6. Download Job PDF from Supabase
# -------------------------------
def get_job_pdf_url(job_id: int) -> str:
    response = supabase.table("job_pdfs").select("job_pdf_url").eq("job_id", job_id).execute()
    if response.data and len(response.data) > 0:
        return response.data[0]["job_pdf_url"]
    else:
        raise ValueError(f"No job PDF found for job_id: {job_id}")

def download_pdf(url: str, local_path: str):
    r = requests.get(url)
    if r.status_code == 200:
        with open(local_path, "wb") as f:
            f.write(r.content)
    else:
        raise RuntimeError(f"Failed to download PDF. Status: {r.status_code}, Message: {r.text}")

# -------------------------------
# 7. JSON Schema Definition
# -------------------------------
job_schema = {
    "type": "object",
    "properties": {
        "Company Name": {"type": "string"},
        "Criteria": {"type": "array", "items": {"type": "string"}},
        "Salary": {"type": "string"},
        "Duration": {"type": "string"},
        "Any Other Info": {"type": "string"},
    },
    "required": ["Company Name", "Criteria", "Salary", "Duration", "Any Other Info"]
}

# -------------------------------
# 8. Generate JSON using Groq Model
# -------------------------------
def generate_job_json(job_text, api_key):
    client = Groq(api_key=api_key)
    prompt = f"""
You are an AI assistant. You are given a Job Description text.

Extract and return a detailed JSON strictly in the format below:

{{
  "Company Name": "...",
  "Criteria": ["criterion1", "criterion2", "criterion3"],
  "Salary": "...",
  "Duration": "...",
  "Any Other Info": "..."
}}

Instructions:
- "Criteria" must only contain minimum eligibility requirements (min degree, GPA, experience, certifications, skill requirements).
- Job responsibilities/extra details go in "Any Other Info".
- If missing info, put "Not Mentioned".
Return only valid JSON.

Job Description:
\"\"\"{job_text}\"\"\"
"""
    completion = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    response_text = completion.choices[0].message.content.strip()
    try:
        job_json = json.loads(response_text)
    except json.JSONDecodeError:
        job_json = {"raw_output": response_text}
    return job_json

# -------------------------------
# 9. Normalize + Validate JSON
# -------------------------------
def normalize_and_validate(job_json):
    if not isinstance(job_json, dict):
        job_json = {"raw_output": str(job_json)}
    if "raw_output" in job_json:
        return {
            "Company Name": "Not Mentioned",
            "Criteria": ["Not Mentioned"],
            "Salary": "Not Mentioned",
            "Duration": "Not Mentioned",
            "Any Other Info": job_json["raw_output"]
        }
    criteria = job_json.get("Criteria", "")
    if isinstance(criteria, str):
        items = [c.strip("• - \n") for c in criteria.replace("\n", ",").split(",") if c.strip()]
        job_json["Criteria"] = items if items else ["Not Mentioned"]
    elif not isinstance(criteria, list):
        job_json["Criteria"] = ["Not Mentioned"]
    for field in ["Company Name", "Salary", "Duration", "Any Other Info"]:
        if field not in job_json or not str(job_json[field]).strip():
            job_json[field] = "Not Mentioned"
    try:
        validate(instance=job_json, schema=job_schema)
    except ValidationError as e:
        print("Warning: JSON did not fully match schema:", e)
    return job_json

# Set API key
api_key = "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"

# -------------------------------
# 10. Generate Detailed Descriptions
# -------------------------------
def generate_detailed_descriptions(input_file, output_file):
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    client = Groq(api_key=api_key)
    detailed_data = {}

    def get_description(prompt_text):
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "user", "content": prompt_text}],
            temperature=0.3
        )
        return completion.choices[0].message.content.strip()

    detailed_data["Company Name"] = get_description(f"Describe company:\n\n{data['Company Name']}")
    detailed_data["Salary"] = get_description(f"Describe salary:\n\n{data['Salary']}")
    detailed_data["Duration"] = get_description(f"Describe duration:\n\n{data['Duration']}")
    detailed_data["Criteria"] = [
        get_description(f"Describe eligibility requirement:\n\n{c}") for c in data.get("Criteria", [])
    ]
    detailed_data["Any Other Info"] = get_description(f"Describe extra info:\n\n{data['Any Other Info']}")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(detailed_data, f, indent=4, ensure_ascii=False)

# -------------------------------
# 11. FastAPI Endpoint to Update Job
# -------------------------------
@app.post("/update_job")
async def update_job(job_id: int = Form(...)):
    """
    Fetch JD PDF from Supabase job_pdfs table, process it, update jobs row.
    """
    try:
        print(f"Processing job ID: {job_id}")
        
        # 1. Download JD PDF
        print("Step 1: Getting job PDF URL...")
        job_pdf_url = get_job_pdf_url(job_id)
        print(f"Found PDF URL: {job_pdf_url}")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            print("Step 2: Downloading PDF...")
            download_pdf(job_pdf_url, tmp_file.name)
            temp_file_path = tmp_file.name
            print(f"Downloaded to: {temp_file_path}")

        # 2. Extract text
        print("Step 3: Extracting text from document...")
        job_text = extract_text_from_file(temp_file_path)
        print(f"Extracted {len(job_text)} characters")

        # 3. Generate structured JSON
        print("Step 4: Generating structured JSON with AI...")
        GROQ_API_KEY = "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"
        job_json = generate_job_json(job_text, GROQ_API_KEY)
        print(f"Generated JSON: {job_json}")

        # 4. Normalize & validate
        print("Step 5: Normalizing and validating JSON...")
        job_json = normalize_and_validate(job_json)

        # 5. Save structured JSON
        structured_file = "jsona.json"
        with open(structured_file, "w", encoding="utf-8") as f:
            json.dump(job_json, f, indent=4, ensure_ascii=False)
        print("Saved structured JSON")

        # 6. Generate detailed descriptions
        print("Step 6: Generating detailed descriptions...")
        detailed_file = "jsonb.json"
        generate_detailed_descriptions(structured_file, detailed_file)
        print("Generated detailed descriptions")

        # 7. Prepare data for Supabase update
        print("Step 7: Preparing data for database update...")
        criteria_text = "\n".join(job_json.get("Criteria", []))
        data_to_update = {
            "title": job_json.get("Duration", "Not Mentioned"),
            "detailed_description": job_json.get("Any Other Info", ""),
            "salary_range": job_json.get("Salary", ""),
            "criteria": criteria_text,
            "company_name": job_json.get("Company Name", "Not Mentioned"),
            "updated_at": datetime.utcnow().isoformat()
        }
        print(f"Update data: {data_to_update}")

        # 8. Update jobs row
        print("Step 8: Updating database...")
        response = supabase.table("jobs").update(data_to_update).eq("id", job_id).execute()
        print(f"Database update response: {response}")

        # Clean up temp file
        try:
            os.unlink(temp_file_path)
        except:
            pass

        print(f"Successfully processed job {job_id}")
        return JSONResponse(content={
            "status": "success",
            "job_id": job_id,
            "updated_row": response.data,
            "structured_json": job_json
        })

    except Exception as e:
        print(f"Error processing job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# 12. Run Server (if called directly)
# -------------------------------
if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI server with CORS enabled...")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=True,
        access_log=True,
        log_level="info"
    )