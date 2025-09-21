from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
from supabase import create_client, Client
import os
import random
from typing import List, Optional, Union
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Candidate Shortlisting API", version="1.0.0")

# Supabase configuration
SUPABASE_URL = "https://iplkewjfgukcflkajmzz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbGtld2pmZ3VrY2Zsa2FqbXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDM1NjMsImV4cCI6MjA3Mzg3OTU2M30.Uu8odziaWjN9aKCmVF2klXAip3Y8woJ6t66XztYQuD0"

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Pydantic models
class ShortlistRequest(BaseModel):
    job_id: Union[str, int]  # Accept both string and int
    num_candidates: int
    
    @field_validator('job_id')
    @classmethod
    def convert_job_id_to_string(cls, v):
        return str(v)  # Convert to string regardless of input type

class CandidateResponse(BaseModel):
    id: Union[str, int]
    user_id: Union[str, int]
    job_id: Union[str, int]
    total_score: float
    experience: float
    skills: float
    education: float
    hireability_percentage: float
    status: str
    remarks: Optional[str] = None
    acceptance: Optional[str] = None
    
    @field_validator('id', 'user_id', 'job_id')
    @classmethod
    def convert_ids_to_string(cls, v):
        return str(v)  # Convert all ID fields to strings

class ShortlistResponse(BaseModel):
    job_id: str
    requested_candidates: int
    shortlisted_candidates: List[CandidateResponse]
    total_applications: int
    selection_summary: dict

@app.post("/shortlist-candidates", response_model=ShortlistResponse)
async def shortlist_candidates(request: ShortlistRequest):
    """
    Shortlist candidates based on the following criteria:
    1. Sort by total_score (descending)
    2. If tied, sort by experience score (descending)
    3. If still tied, select randomly
    4. Update database with acceptance status
    """
    try:
        # Validate input
        if request.num_candidates <= 0:
            raise HTTPException(status_code=400, detail="Number of candidates must be greater than 0")
        
        # Fetch all job applications for the given job_id
        logger.info(f"Fetching applications for job_id: {request.job_id}")
        
        response = supabase.table("job_applications").select("*").eq("job_id", request.job_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=404, 
                detail=f"No applications found for job_id: {request.job_id}"
            )
        
        applications = response.data
        total_applications = len(applications)
        
        logger.info(f"Found {total_applications} applications for job_id: {request.job_id}")
        
        # Check if requested number exceeds available applications
        if request.num_candidates > total_applications:
            logger.warning(f"Requested {request.num_candidates} candidates, but only {total_applications} applications available")
        
        # Sort applications based on the specified criteria
        def sort_key(app):
            # Return tuple for sorting: (total_score, experience, random_value)
            # Negative values for descending order
            return (-app['total_score'], -app['experience'], random.random())
        
        # Set random seed for reproducibility (optional)
        random.seed(42)
        
        # Sort applications
        sorted_applications = sorted(applications, key=sort_key)
        
        # Select top N candidates
        num_to_select = min(request.num_candidates, total_applications)
        shortlisted = sorted_applications[:num_to_select]
        
        # Get shortlisted candidate IDs and user IDs
        shortlisted_ids = [app['id'] for app in shortlisted]
        shortlisted_user_ids = [app['user_id'] for app in shortlisted]
        
        logger.info(f"Shortlisted {len(shortlisted_ids)} candidates: {shortlisted_ids}")
        
        # Update database - Set shortlisted candidates as "accepted"
        try:
            for app in shortlisted:
                update_response = supabase.table("job_applications").update({
                    "acceptance": "accepted"
                }).eq("job_id", request.job_id).eq("user_id", app['user_id']).execute()
                
                if not update_response.data:
                    logger.warning(f"Failed to update acceptance status for user_id: {app['user_id']}")
            
            logger.info(f"Successfully updated {len(shortlisted)} candidates as 'accepted'")
            
        except Exception as update_error:
            logger.error(f"Error updating shortlisted candidates: {str(update_error)}")
            raise HTTPException(status_code=500, detail=f"Failed to update shortlisted candidates: {str(update_error)}")
        
        # Update database - Set remaining candidates as "rejected"
        try:
            # Get all application IDs for this job
            all_app_ids = [app['id'] for app in applications]
            rejected_app_ids = [app_id for app_id in all_app_ids if app_id not in shortlisted_ids]
            
            # Update rejected candidates in batch
            if rejected_app_ids:
                for app in applications:
                    if app['id'] not in shortlisted_ids:
                        reject_response = supabase.table("job_applications").update({
                            "acceptance": "rejected"
                        }).eq("job_id", request.job_id).eq("user_id", app['user_id']).execute()
                        
                        if not reject_response.data:
                            logger.warning(f"Failed to update rejection status for user_id: {app['user_id']}")
                
                logger.info(f"Successfully updated {len(rejected_app_ids)} candidates as 'rejected'")
            
        except Exception as reject_error:
            logger.error(f"Error updating rejected candidates: {str(reject_error)}")
            raise HTTPException(status_code=500, detail=f"Failed to update rejected candidates: {str(reject_error)}")
        
        # Prepare response data with updated acceptance status
        shortlisted_candidates = []
        for app in shortlisted:
            candidate = CandidateResponse(
                id=app['id'],
                user_id=app['user_id'],
                job_id=app['job_id'],
                total_score=app['total_score'],
                experience=app['experience'],
                skills=app['skills'],
                education=app['education'],
                hireability_percentage=app['hireability_percentage'],
                status=app['status'],
                remarks=app.get('remarks'),
                acceptance="accepted"  # Updated status
            )
            shortlisted_candidates.append(candidate)
        
        # Create selection summary
        selection_summary = {
            "top_score": shortlisted[0]['total_score'] if shortlisted else 0,
            "lowest_selected_score": shortlisted[-1]['total_score'] if shortlisted else 0,
            "score_range": {
                "min": min(app['total_score'] for app in shortlisted) if shortlisted else 0,
                "max": max(app['total_score'] for app in shortlisted) if shortlisted else 0
            },
            "tied_candidates_info": get_tie_info(sorted_applications, num_to_select),
            "database_updates": {
                "accepted_candidates": len(shortlisted_ids),
                "rejected_candidates": total_applications - len(shortlisted_ids),
                "total_updated": total_applications
            }
        }
        
        logger.info(f"Successfully processed shortlisting for job_id: {request.job_id}")
        logger.info(f"Accepted: {len(shortlisted_ids)}, Rejected: {total_applications - len(shortlisted_ids)}")
        
        return ShortlistResponse(
            job_id=request.job_id,
            requested_candidates=request.num_candidates,
            shortlisted_candidates=shortlisted_candidates,
            total_applications=total_applications,
            selection_summary=selection_summary
        )
    
    except Exception as e:
        logger.error(f"Error in shortlist_candidates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

def get_tie_info(sorted_applications: List[dict], num_selected: int) -> dict:
    """
    Analyze if there were ties in the selection process
    """
    if not sorted_applications or num_selected >= len(sorted_applications):
        return {"ties_detected": False, "tie_details": None}
    
    # Check for ties at the cutoff point
    cutoff_score = sorted_applications[num_selected - 1]['total_score']
    cutoff_experience = sorted_applications[num_selected - 1]['experience']
    
    # Count candidates with same total score as the last selected candidate
    tied_candidates = [
        app for app in sorted_applications 
        if app['total_score'] == cutoff_score
    ]
    
    # Count candidates with same total score AND experience as the last selected candidate
    exact_tied_candidates = [
        app for app in tied_candidates 
        if app['experience'] == cutoff_experience
    ]
    
    ties_detected = len(tied_candidates) > 1 or len(exact_tied_candidates) > 1
    
    return {
        "ties_detected": ties_detected,
        "tie_details": {
            "cutoff_score": cutoff_score,
            "candidates_with_same_total_score": len(tied_candidates),
            "candidates_with_same_total_and_experience": len(exact_tied_candidates),
            "random_selection_used": len(exact_tied_candidates) > 1
        } if ties_detected else None
    }

@app.post("/preview-shortlist", response_model=ShortlistResponse)
async def preview_shortlist(request: ShortlistRequest):
    """
    Preview shortlisted candidates WITHOUT updating the database.
    Same sorting logic as shortlist_candidates but no DB updates.
    """
    try:
        # Validate input
        if request.num_candidates <= 0:
            raise HTTPException(status_code=400, detail="Number of candidates must be greater than 0")
        
        # Fetch all job applications for the given job_id
        logger.info(f"Previewing shortlist for job_id: {request.job_id}")
        
        response = supabase.table("job_applications").select("*").eq("job_id", request.job_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=404, 
                detail=f"No applications found for job_id: {request.job_id}"
            )
        
        applications = response.data
        total_applications = len(applications)
        
        logger.info(f"Found {total_applications} applications for job_id: {request.job_id}")
        
        # Check if requested number exceeds available applications
        if request.num_candidates > total_applications:
            logger.warning(f"Requested {request.num_candidates} candidates, but only {total_applications} applications available")
        
        # Sort applications based on the specified criteria
        def sort_key(app):
            # Return tuple for sorting: (total_score, experience, random_value)
            # Negative values for descending order
            return (-app['total_score'], -app['experience'], random.random())
        
        # Set random seed for reproducibility (optional)
        random.seed(42)
        
        # Sort applications
        sorted_applications = sorted(applications, key=sort_key)
        
        # Select top N candidates
        num_to_select = min(request.num_candidates, total_applications)
        shortlisted = sorted_applications[:num_to_select]
        
        # Prepare response data (no database updates)
        shortlisted_candidates = []
        for app in shortlisted:
            candidate = CandidateResponse(
                id=app['id'],
                user_id=app['user_id'],
                job_id=app['job_id'],
                total_score=app['total_score'],
                experience=app['experience'],
                skills=app['skills'],
                education=app['education'],
                hireability_percentage=app['hireability_percentage'],
                status=app['status'],
                remarks=app.get('remarks'),
                acceptance="would_be_accepted"  # Preview status
            )
            shortlisted_candidates.append(candidate)
        
        # Create selection summary
        selection_summary = {
            "top_score": shortlisted[0]['total_score'] if shortlisted else 0,
            "lowest_selected_score": shortlisted[-1]['total_score'] if shortlisted else 0,
            "score_range": {
                "min": min(app['total_score'] for app in shortlisted) if shortlisted else 0,
                "max": max(app['total_score'] for app in shortlisted) if shortlisted else 0
            },
            "tied_candidates_info": get_tie_info(sorted_applications, num_to_select),
            "preview_mode": True,
            "database_updates": {
                "would_accept": len(shortlisted),
                "would_reject": total_applications - len(shortlisted),
                "total_affected": total_applications
            }
        }
        
        logger.info(f"Preview completed for job_id: {request.job_id}")
        
        return ShortlistResponse(
            job_id=request.job_id,
            requested_candidates=request.num_candidates,
            shortlisted_candidates=shortlisted_candidates,
            total_applications=total_applications,
            selection_summary=selection_summary
        )
    
    except Exception as e:
        logger.error(f"Error in preview_shortlist: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/job-applications/{job_id}")
async def get_job_applications(job_id: str):
    """
    Get all applications for a specific job (for debugging/verification)
    """
    try:
        response = supabase.table("job_applications").select("*").eq("job_id", job_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=404, 
                detail=f"No applications found for job_id: {job_id}"
            )
        
        return {
            "job_id": job_id,
            "total_applications": len(response.data),
            "applications": response.data
        }
    
    except Exception as e:
        logger.error(f"Error fetching job applications: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {"status": "healthy", "message": "Candidate Shortlisting API is running"}

@app.get("/")
async def root():
    """
    Root endpoint with API information
    """
    return {
        "message": "Candidate Shortlisting API",
        "version": "1.0.0",
        "endpoints": {
            "POST /shortlist-candidates": "Shortlist candidates for a job",
            "GET /job-applications/{job_id}": "Get all applications for a job",
            "GET /health": "Health check"
        }
    }

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)