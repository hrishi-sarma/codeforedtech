from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import subprocess
import sys
import requests
import asyncio
import time
from supabase import create_client, Client
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import logging
from typing import Optional
import traceback

# -------------------------------
# Setup logging with more detail
# -------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)

# -------------------------------
# FastAPI setup with enhanced configuration
# -------------------------------
app = FastAPI(
    title="Resume & Job PDF Processor",
    description="API for processing user resumes and job PDFs to calculate application scores",
    version="1.0.0",
    debug=True
)

# -------------------------------
# Enhanced CORS Middleware with explicit configuration
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://0.0.0.0:3000",
        "*"  # Allow all origins for development - remove in production
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "accept",
        "accept-encoding", 
        "authorization",
        "content-type",
        "dnt",
        "origin",
        "user-agent",
        "x-csrftoken",
        "x-requested-with",
    ],
)

# Add custom middleware to log requests and handle CORS preflight
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log incoming request
    logger.info(f"🌐 {request.method} {request.url}")
    logger.info(f"📥 Headers: {dict(request.headers)}")
    
    # Handle preflight OPTIONS requests
    if request.method == "OPTIONS":
        response = JSONResponse({"message": "OK"})
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"⏱️  Request completed in {process_time:.2f}s - Status: {response.status_code}")
        
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        
        return response
    except Exception as e:
        logger.error(f"❌ Request failed: {str(e)}")
        logger.error(f"🔍 Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(e)}"}
        )

# -------------------------------
# Health check endpoints
# -------------------------------
@app.get("/")
async def root():
    """Root endpoint with basic info"""
    logger.info("📋 Root endpoint accessed")
    return {
        "message": "parsePDF Resume & Job PDF Processor API",
        "status": "parsePDF server is running",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "process_pdfs": "/process_pdfs",
            "test": "/test"
        },
        "timestamp": time.time(),
        "port": 8001,
        "cors_enabled": True
    }

@app.get("/health")
async def detailed_health_check():
    """Detailed health check for debugging"""
    logger.info("🏥 Health check requested")
    
    try:
        # Test Supabase connection
        supabase_status = "unknown"
        supabase_details = {}
        try:
            logger.info("🔗 Testing Supabase connection...")
            response = supabase.table("user_profiles").select("count", count="exact").limit(1).execute()
            supabase_status = "connected"
            supabase_details = {
                "status": "connected",
                "url": SUPABASE_URL,
                "table_accessible": True
            }
            logger.info("✅ Supabase connection: OK")
        except Exception as e:
            supabase_status = f"error: {str(e)[:100]}"
            supabase_details = {
                "status": "error",
                "error": str(e),
                "url": SUPABASE_URL
            }
            logger.error(f"❌ Supabase connection failed: {e}")
        
        # Check if required scripts exist
        scripts_status = {}
        required_scripts = [
            "attempt2.py",
            "structure_parser.py", 
            "detailed_json.py",
            "criteria_checker.py"
        ]
        
        logger.info("📁 Checking required scripts...")
        for script in required_scripts:
            exists = os.path.exists(script)
            scripts_status[script] = {
                "exists": exists,
                "path": os.path.abspath(script) if exists else "not found"
            }
            logger.info(f"   📄 {script}: {'✅ found' if exists else '❌ missing'}")
        
        # Check Python environment
        python_info = {
            "version": sys.version,
            "executable": sys.executable,
            "path": sys.path[:3]  # First 3 paths
        }
        
        health_data = {
            "status": "healthy",
            "server": {
                "running": True,
                "port": 8001,
                "cors_enabled": True,
                "timestamp": time.time()
            },
            "supabase": supabase_details,
            "scripts": scripts_status,
            "python": python_info,
            "working_directory": os.getcwd(),
            "environment_vars": {
                "USER_ID": os.getenv("USER_ID", "not_set"),
                "JOB_ID": os.getenv("JOB_ID", "not_set"),
                "PYTHONPATH": os.getenv("PYTHONPATH", "not_set")
            }
        }
        
        logger.info("✅ Health check completed successfully")
        return health_data
        
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        logger.error(f"🔍 Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.post("/test")
async def test_endpoint():
    """Simple test endpoint to verify server is responding"""
    logger.info("🧪 Test endpoint accessed")
    return {
        "status": "ok",
        "message": "parsePDF server is responding correctly",
        "timestamp": time.time(),
        "test": "passed",
        "server_info": {
            "python_version": sys.version,
            "working_dir": os.getcwd(),
            "port": 8001
        }
    }

# -------------------------------
# Supabase configuration
# -------------------------------
SUPABASE_URL = "https://iplkewjfgukcflkajmzz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbGtld2pmZ3VrY2Zsa2FqbXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDM1NjMsImV4cCI6MjA3Mzg3OTU2M30.Uu8odziaWjN9aKCmVF2klXAip3Y8woJ6t66XztYQuD0"

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Supabase client initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize Supabase client: {e}")
    raise

# -------------------------------
# Request body schema
# -------------------------------
class ProcessRequest(BaseModel):
    user_id: str
    job_id: int

    class Config:
        schema_extra = {
            "example": {
                "user_id": "12345678-1234-1234-1234-123456789abc",
                "job_id": 1
            }
        }

# -------------------------------
# Enhanced utility functions with timeouts
# -------------------------------
def get_resume_url(user_id: str) -> str:
    """Get resume URL with timeout and better error handling"""
    try:
        logger.info(f"📄 Fetching resume URL for user: {user_id}")
        response = supabase.table("user_profiles").select("resume_url").eq("id", user_id).execute()
        
        if response.data and len(response.data) > 0:
            resume_url = response.data[0]["resume_url"]
            if not resume_url:
                raise ValueError(f"Resume URL is empty for user_id: {user_id}. Please upload a resume first.")
            logger.info(f"✅ Found resume URL: {resume_url[:100]}...")
            return resume_url
        else:
            raise ValueError(f"No resume found for user_id: {user_id}. Please upload a resume in your profile.")
    except Exception as e:
        logger.error(f"❌ Error fetching resume URL: {e}")
        raise

def get_job_pdf_url(job_id: int) -> str:
    """Get job PDF URL with timeout and better error handling"""
    try:
        logger.info(f"📋 Fetching job PDF URL for job: {job_id}")
        response = supabase.table("job_pdfs").select("job_pdf_url").eq("job_id", job_id).execute()
        
        if response.data and len(response.data) > 0:
            job_pdf_url = response.data[0]["job_pdf_url"]
            if not job_pdf_url:
                raise ValueError(f"Job PDF URL is empty for job_id: {job_id}")
            logger.info(f"✅ Found job PDF URL: {job_pdf_url[:100]}...")
            return job_pdf_url
        else:
            raise ValueError(f"No job PDF found for job_id: {job_id}")
    except Exception as e:
        logger.error(f"❌ Error fetching job PDF URL: {e}")
        raise

def download_pdf_with_timeout(url: str, local_path: str, timeout: int = 45):
    """Download PDF with timeout and better error handling"""
    try:
        logger.info(f"⬇️ Downloading PDF from {url[:100]}... to {local_path}")
        
        # Add timeout to the request
        response = requests.get(
            url, 
            timeout=timeout, 
            stream=True,
            headers={
                'User-Agent': 'parsePDF-Server/1.0',
                'Accept': 'application/pdf,*/*'
            }
        )
        
        logger.info(f"📥 HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            # Write in chunks for large files
            total_size = 0
            with open(local_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:  # filter out keep-alive chunks
                        f.write(chunk)
                        total_size += len(chunk)
            
            # Verify file was created and has content
            if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
                logger.info(f"✅ PDF downloaded successfully: {local_path} ({total_size} bytes)")
            else:
                raise RuntimeError(f"Downloaded file is empty or doesn't exist: {local_path}")
        else:
            error_text = response.text[:200] if response.text else "No error message"
            raise RuntimeError(f"Failed to download PDF. Status: {response.status_code}, Message: {error_text}")
            
    except requests.exceptions.Timeout:
        raise RuntimeError(f"Timeout downloading PDF from {url[:100]}... (>{timeout}s)")
    except requests.exceptions.ConnectionError:
        raise RuntimeError(f"Connection error downloading PDF from {url[:100]}...")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error downloading PDF: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Error downloading PDF: {e}")
        raise

def run_script_with_timeout(script_name: str, args: list, env: dict, timeout: int = 600):
    """Run a script with timeout and better error handling"""
    try:
        logger.info(f"🚀 Starting script: {script_name} with args: {args}")
        
        # Verify script exists
        if not os.path.exists(script_name):
            raise FileNotFoundError(f"Script {script_name} not found in current directory: {os.getcwd()}")
        
        # Log the command being executed
        cmd = [sys.executable, script_name] + args
        logger.info(f"💻 Executing: {' '.join(cmd)}")
        logger.info(f"📁 Working directory: {os.getcwd()}")
        logger.info(f"🔧 Environment variables: USER_ID={env.get('USER_ID')}, JOB_ID={env.get('JOB_ID')}")
        
        # Set up environment with UTF-8 encoding for Windows
        script_env = env.copy()
        script_env['PYTHONIOENCODING'] = 'utf-8'
        script_env['PYTHONLEGACYWINDOWSFSENCODING'] = '0'
        
        # Run the script with timeout
        start_time = time.time()
        result = subprocess.run(
            cmd,
            env=script_env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=True,
            cwd=os.getcwd(),
            encoding='utf-8',
            errors='replace'  # Replace problematic characters instead of failing
        )
        
        execution_time = time.time() - start_time
        logger.info(f"✅ Script {script_name} completed successfully in {execution_time:.2f}s")
        
        if result.stdout:
            logger.info(f"📋 Script output: {result.stdout[:500]}...")
        if result.stderr:
            logger.warning(f"⚠️ Script stderr: {result.stderr[:500]}...")
        
        return result
        
    except FileNotFoundError as e:
        logger.error(f"❌ Script file not found: {e}")
        raise RuntimeError(f"Required script {script_name} is missing from {os.getcwd()}")
    except subprocess.TimeoutExpired:
        logger.error(f"⏰ Script {script_name} timed out after {timeout} seconds")
        raise RuntimeError(f"Script {script_name} timed out - processing took too long")
    except subprocess.CalledProcessError as e:
        logger.error(f"💥 Script {script_name} failed with return code {e.returncode}")
        logger.error(f"Error output: {e.stderr}")
        
        # Try to provide more specific error messages
        if e.stderr:
            if "UnicodeEncodeError" in str(e.stderr):
                raise RuntimeError(f"Script {script_name} failed due to Unicode encoding issue - this is a Windows-specific problem that should be resolved by the encoding fix")
            elif "No such file or directory" in str(e.stderr):
                raise RuntimeError(f"Script {script_name} failed: Missing required files or dependencies")
            elif "Permission denied" in str(e.stderr):
                raise RuntimeError(f"Script {script_name} failed: Permission denied - check file permissions")
            elif "ModuleNotFoundError" in str(e.stderr):
                raise RuntimeError(f"Script {script_name} failed: Python module not found - check dependencies")
            else:
                raise RuntimeError(f"Script {script_name} failed: {e.stderr}")
        else:
            raise RuntimeError(f"Script {script_name} failed with return code {e.returncode}")
    except Exception as e:
        logger.error(f"❌ Unexpected error running script {script_name}: {e}")
        logger.error(f"🔍 Traceback: {traceback.format_exc()}")
        raise RuntimeError(f"Unexpected error in script {script_name}: {str(e)}")

# -------------------------------
# Enhanced FastAPI POST endpoint
# -------------------------------
@app.post("/process_pdfs")
async def process_pdfs(request: ProcessRequest):
    start_time = time.time()
    logger.info("="*80)
    logger.info("📄 RECEIVED PDF PROCESSING REQUEST")
    logger.info(f"👤 User ID: {request.user_id}")
    logger.info(f"💼 Job ID: {request.job_id}")
    logger.info("="*80)
    
    try:
        # Validate input
        if not request.user_id or not request.user_id.strip():
            raise HTTPException(status_code=400, detail="Invalid user_id provided")
        if not request.job_id or request.job_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid job_id provided")
        
        # Define scripts in execution order
        scripts_order = [
            "attempt2.py",
            "structure_parser.py", 
            "detailed_json.py",
            "criteria_checker.py"
        ]

        # Verify all scripts exist before starting
        logger.info("🔍 Verifying required scripts...")
        missing_scripts = []
        for script in scripts_order:
            script_path = os.path.abspath(script)
            if not os.path.exists(script):
                missing_scripts.append(f"{script} (expected at: {script_path})")
                logger.error(f"❌ Missing script: {script} at {script_path}")
            else:
                logger.info(f"✅ Found script: {script} at {script_path}")
        
        if missing_scripts:
            error_msg = f"Missing required scripts: {missing_scripts}"
            logger.error(f"❌ {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=f"Server configuration error: {error_msg}"
            )
        
        logger.info("✅ All required scripts found")

        logger.info("📥 DOWNLOADING PDFS")
        
        # Download resume PDF with error handling and timeouts
        try:
            logger.info("📄 Downloading user resume...")
            resume_url = get_resume_url(request.user_id)
            download_pdf_with_timeout(resume_url, "resume.pdf", timeout=45)
        except Exception as e:
            logger.error(f"❌ Resume download failed: {e}")
            if "Resume URL is empty" in str(e) or "No resume found" in str(e):
                raise HTTPException(
                    status_code=400, 
                    detail="Resume not found. Please upload your resume in your profile before applying to jobs."
                )
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Resume download failed: {str(e)}"
                )

        try:
            logger.info("📋 Downloading job description...")
            job_pdf_url = get_job_pdf_url(request.job_id)
            download_pdf_with_timeout(job_pdf_url, "job_description.pdf", timeout=45)
        except Exception as e:
            logger.error(f"❌ Job PDF download failed: {e}")
            raise HTTPException(
                status_code=400, 
                detail=f"Job description download failed: {str(e)}"
            )

        # Set environment variables for the scripts
        env = os.environ.copy()
        env["USER_ID"] = request.user_id
        env["JOB_ID"] = str(request.job_id)
        env["PYTHONPATH"] = os.getcwd()  # Ensure current directory is in Python path
        logger.info(f"🔧 Environment variables set: USER_ID={request.user_id}, JOB_ID={request.job_id}")

        logger.info("🚀 RUNNING PDF PROCESSING SCRIPTS")
        
        # Run attempt2.py with resume.pdf first (longer timeout for AI processing)
        logger.info("🧠 Running AI resume analysis (attempt2.py)...")
        run_script_with_timeout(
            "attempt2.py",
            ["resume.pdf"],
            env,
            timeout=600  # 10 minutes for AI processing
        )

        # Run the rest of the scripts with 600s timeout
        for i, script in enumerate(scripts_order[1:], 2):
            logger.info(f"⚙️ Running {script} (step {i}/4)...")
            run_script_with_timeout(script, [], env, timeout=600)

        processing_time = time.time() - start_time
        logger.info("="*80)
        logger.info(f"🎉 ALL SCRIPTS COMPLETED SUCCESSFULLY in {processing_time:.2f} seconds")
        logger.info("="*80)
        
        success_response = {
            "status": "success",
            "message": "PDF processing completed successfully! Application scores have been calculated.",
            "processing_time": round(processing_time, 2),
            "user_id": request.user_id,
            "job_id": request.job_id,
            "scripts_executed": scripts_order,
            "timestamp": time.time()
        }
        
        logger.info(f"📤 Returning success response: {success_response}")
        return success_response

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except subprocess.CalledProcessError as e:
        error_msg = f"Processing script failed: {e}"
        logger.error(f"💥 SUBPROCESS ERROR: {error_msg}")
        logger.error(f"🔍 Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"PDF processing failed during script execution: {str(e)}"
        )
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ GENERAL ERROR: {error_msg}")
        logger.error(f"🔍 Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"PDF processing failed: {error_msg}"
        )
    finally:
        # Clean up downloaded files
        cleanup_start = time.time()
        try:
            files_cleaned = []
            for file in ["resume.pdf", "job_description.pdf"]:
                if os.path.exists(file):
                    os.remove(file)
                    files_cleaned.append(file)
            
            if files_cleaned:
                cleanup_time = time.time() - cleanup_start
                logger.info(f"🧹 Cleaned up files: {files_cleaned} ({cleanup_time:.2f}s)")
        except Exception as e:
            logger.warning(f"⚠️ Failed to clean up files: {e}")

# -------------------------------
# Server startup
# -------------------------------
if __name__ == "__main__":
    import uvicorn
    
    logger.info("🚀 Starting parsePDF FastAPI server...")
    logger.info("🌐 Server will be available at:")
    logger.info("   • http://127.0.0.1:8001")
    logger.info("   • http://localhost:8001")
    logger.info("   • API docs: http://127.0.0.1:8001/docs")
    logger.info("   • Health check: http://127.0.0.1:8001/health")
    logger.info("   • Test endpoint: http://127.0.0.1:8001/test")
    
    try:
        uvicorn.run(
            app, 
            host="127.0.0.1", 
            port=8001,
            reload=True,
            access_log=True,
            log_level="info"
        )
    except Exception as e:
        logger.error(f"❌ Failed to start server: {e}")
        raise