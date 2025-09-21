import json
import re
import logging
import os
import subprocess
import sys
from groq import Groq
from supabase import create_client, Client

# Set UTF-8 encoding for Windows compatibility
if sys.platform.startswith('win'):
    # Ensure proper encoding on Windows
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())
    # Set console output to UTF-8
    os.system('chcp 65001 >nul 2>&1')

# -----------------------
# Configuration
# -----------------------
API_KEY = os.getenv("GROQ_API_KEY", "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")
MODEL_HIGH = "qwen/qwen3-32b"   # used for fine-grained scoring
MODEL_LOW = "openai/gpt-oss-20b"     # used for explanation / rejection reason
DEFAULT_MAX_TOKENS = 200
DEFAULT_TEMPERATURE = 0.25
SCORE_THRESHOLD = 0.6          # overall score threshold to mark a criterion satisfied
SECTION_MATCH_THRESHOLD = 0.30 # section score threshold to be considered a "matched section"

# Acceptance thresholds
ACCEPTANCE_PERCENTAGE_THRESHOLD = 0.60  # Accept if 75% or more criteria are satisfied
MINIMUM_CRITERIA_COUNT = 1            # Minimum number of criteria that must be satisfied

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iplkewjfgukcflkajmzz.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbGtld2pmZ3VrY2Zsa2FqbXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDM1NjMsImV4cCI6MjA3Mzg3OTU2M30.Uu8odziaWjN9aKCmVF2klXAip3Y8woJ6t66XztYQuD0")

# -----------------------
# Logging with Unicode support
# -----------------------
logging.basicConfig(
    level=logging.INFO, 
    format="%(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("resume_screen")

# -----------------------
# Initialize clients
# -----------------------
client = Groq(api_key=API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------
# Unicode-safe string handling
# -----------------------
def safe_str(text):
    """Safely handle Unicode strings across platforms"""
    if text is None:
        return ""
    if isinstance(text, bytes):
        try:
            return text.decode('utf-8')
        except UnicodeDecodeError:
            return text.decode('utf-8', errors='replace')
    return str(text)

def safe_print(text, encoding='utf-8'):
    """Safely print Unicode text on Windows"""
    try:
        print(safe_str(text))
    except UnicodeEncodeError:
        # Fallback for problematic characters
        print(safe_str(text).encode('ascii', errors='replace').decode('ascii'))

# -----------------------
# Database Helper Functions
# -----------------------
def update_job_application_status(user_id, job_id, acceptance, remarks):
    """
    Update job application acceptance status in the database
    """
    try:
        # Ensure remarks are properly encoded
        remarks = safe_str(remarks)
        
        result = supabase.table('job_applications').update({
            'acceptance': acceptance,
            'remarks': remarks
        }).eq('user_id', user_id).eq('job_id', job_id).execute()
        
        log.info(f"Database updated successfully for user_id: {user_id}, job_id: {job_id}")
        return True
    except Exception as e:
        log.error(f"Database update failed: {safe_str(e)}")
        return False

def run_embed_script():
    """
    Run embed.py script for accepted candidates with environment variables forwarded
    """
    try:
        env = os.environ.copy()
        # Ensure UTF-8 encoding for subprocess on Windows
        if sys.platform.startswith('win'):
            env['PYTHONIOENCODING'] = 'utf-8'
        
        result = subprocess.run(
            [sys.executable, 'embed.py'], 
            capture_output=True, 
            text=True, 
            env=env,
            encoding='utf-8',
            errors='replace'
        )
        
        if result.returncode == 0:
            log.info("embed.py executed successfully")
            if result.stdout:
                log.info(f"Output: {safe_str(result.stdout)}")
        else:
            log.error(f"embed.py failed with error: {safe_str(result.stderr)}")
        return result.returncode == 0
    except Exception as e:
        log.error(f"Failed to run embed.py: {safe_str(e)}")
        return False

# -----------------------
# Helper: call Groq with retry logic
# -----------------------
def call_groq(model, prompt, max_tokens=DEFAULT_MAX_TOKENS, temperature=DEFAULT_TEMPERATURE, max_retries=3):
    """
    Calls the Groq client with retry logic for rate limiting.
    """
    import time
    
    for attempt in range(max_retries):
        try:
            # Ensure prompt is properly encoded
            prompt = safe_str(prompt)
            
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a precise resume screening assistant. Focus on accuracy and consistency in your evaluations."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            response_content = completion.choices[0].message.content
            return safe_str(response_content).strip()
            
        except Exception as e:
            error_str = safe_str(e)
            if "rate limit" in error_str.lower() and attempt < max_retries - 1:
                wait_time = (2 ** attempt) + 1  # Exponential backoff
                log.info(f"Rate limit hit, waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            else:
                raise Exception(error_str)
    
    raise Exception("Max retries exceeded")

# -----------------------
# Helper: parse model response for JSON-like {"score":..., "reason":"..."}
# -----------------------
def parse_score_reason(text):
    """
    Accepts either strict JSON like {"score": 0.8, "reason": "..."} or free text containing
    a score number and an explanation. Returns tuple (score: float in [0,1], reason: str).
    """
    text = safe_str(text)
    
    # First try strict JSON
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and "score" in parsed:
            score = float(parsed.get("score", 0.0))
            reason = safe_str(parsed.get("reason", "")).strip()
            score = max(0.0, min(1.0, score))
            return score, reason
    except Exception:
        pass

    # Try to find a floating number in the text (0-1 or 0-100)
    m = re.search(r"([0]?\.?\d{1,3})\s*(?:$|[^0-9%])", text)
    if m:
        try:
            val = float(m.group(1))
            if val > 1.0:
                if val <= 100.0:
                    score = val / 100.0
                else:
                    score = 1.0
            else:
                score = val
            score = max(0.0, min(1.0, score))
            reason = text.replace(m.group(1), "").strip()
            return score, reason
        except Exception:
            pass

    # Try percentage pattern
    m2 = re.search(r"(\d{1,3})\s*%", text)
    if m2:
        try:
            score = float(m2.group(1)) / 100.0
            score = max(0.0, min(1.0, score))
            reason = re.sub(r"\d{1,3}\s*%", "", text).strip()
            return score, reason
        except Exception:
            pass

    # If all fails, return 0.0 with full text as reason
    return 0.0, text.strip()

# -----------------------
# Criterion Type Detection
# -----------------------
def detect_criterion_type(criterion):
    """
    Detect the type of criterion to apply appropriate evaluation logic
    """
    criterion = safe_str(criterion)
    criterion_lower = criterion.lower()
    
    # Education/Degree requirements
    if any(word in criterion_lower for word in ['degree', 'bachelor', 'master', 'phd', 'diploma', 'graduation']):
        return 'education'
    
    # Experience requirements
    if any(word in criterion_lower for word in ['experience', 'years', 'worked', 'employment']):
        return 'experience'
    
    # Skills/Technical requirements
    if any(word in criterion_lower for word in ['proficient', 'skilled', 'knowledge of', 'experience with', 'familiar with']):
        return 'skill'
    
    # Certification requirements
    if any(word in criterion_lower for word in ['certified', 'certification', 'license']):
        return 'certification'
    
    # Default to general
    return 'general'

# -----------------------
# Smart Section Scoring
# -----------------------
def evaluate_section_for_criterion(section, content, criterion, criterion_type, model=MODEL_HIGH):
    """
    Evaluate a resume section against a criterion with type-aware prompting
    """
    if not content or content in [None, "", [], {}]:
        return 0.0, "Section is empty or contains no relevant information"
    
    # Safely handle content conversion
    content_str = safe_str(content)[:1200]
    criterion = safe_str(criterion)
    section = safe_str(section)
    
    # Create type-specific prompts
    base_context = f"""
Resume Section: {section}
Content: {content_str}
Job Requirement: {criterion}
"""
    
    if criterion_type == 'education':
        prompt = f"""{base_context}

EDUCATION EVALUATION: This criterion requires specific educational qualifications.

Instructions:
- If the content shows the candidate has the required degree/education, score 1.0
- If the content shows related but not exact education, score 0.5-0.8
- If the content shows no relevant education, score 0.0
- Focus on degree type, field of study, and level of education
- Consider equivalent degrees (B.Tech = B.E. = B.S.)

Respond as JSON: {{"score": <float 0-1>, "reason": "<brief explanation>"}}
"""
    
    elif criterion_type == 'experience':
        prompt = f"""{base_context}

EXPERIENCE EVALUATION: This criterion requires specific work experience.

Instructions:
- Focus on duration, industry relevance, and role responsibilities
- Consider internships, projects, and volunteer work as relevant experience
- Score based on how well the experience aligns with the requirement
- If duration is specified in the requirement, check if it's met

Respond as JSON: {{"score": <float 0-1>, "reason": "<brief explanation>"}}
"""
    
    elif criterion_type == 'skill':
        prompt = f"""{base_context}

SKILL EVALUATION: This criterion requires specific technical skills or tools.

Instructions:
- Look for exact matches of mentioned skills/tools
- Consider proficiency levels and practical application
- Score 1.0 if skills are explicitly demonstrated
- Score 0.7-0.9 if skills are mentioned but not extensively demonstrated
- Score 0.3-0.6 if related skills are shown

Respond as JSON: {{"score": <float 0-1>, "reason": "<brief explanation>"}}
"""
    
    else:  # general or other types
        prompt = f"""{base_context}

GENERAL EVALUATION: Evaluate how well this section addresses the requirement.

Instructions:
- Consider direct and indirect evidence
- Look for relevant keywords and context
- Score based on strength of evidence and relevance
- Be consistent in your evaluation approach

Respond as JSON: {{"score": <float 0-1>, "reason": "<brief explanation>"}}
"""

    try:
        raw = call_groq(model, prompt, max_tokens=150, temperature=0.2)
        score, reason = parse_score_reason(raw)
        return score, reason
    except Exception as e:
        log.warning(f"API error for section '{section}': {safe_str(e)}")
        return 0.0, f"Evaluation failed: {safe_str(e)[:100]}"

# -----------------------
# Smart Aggregation Logic
# -----------------------
def calculate_overall_score(section_scores, criterion_type):
    """
    Calculate overall score using criterion-type-aware aggregation
    """
    if not section_scores:
        return 0.0
    
    scores_only = [s for (_, s, _) in section_scores]
    
    if criterion_type == 'education':
        # For education, any section with high score should satisfy the requirement
        max_score = max(scores_only)
        # If any section scores high (>0.8), give more weight to that
        if max_score > 0.8:
            return min(1.0, max_score + 0.1)
        else:
            return max_score
    
    elif criterion_type == 'skill':
        # For skills, look for evidence across multiple sections
        max_score = max(scores_only)
        sum_other = sum(scores_only) - max_score
        # Give significant weight to best evidence, but also consider supporting evidence
        return min(1.0, max_score + 0.4 * sum_other)
    
    elif criterion_type == 'experience':
        # For experience, combine evidence from multiple sections
        max_score = max(scores_only)
        sum_other = sum(scores_only) - max_score
        # Weight both primary and supporting evidence
        return min(1.0, max_score + 0.5 * sum_other)
    
    else:  # general
        # Use the original aggregation method
        max_score = max(scores_only)
        sum_other = sum(scores_only) - max_score
        return min(1.0, max_score + 0.3 * sum_other)

def determine_final_status(satisfied_criteria, rejected_criteria, total_criteria):
    """
    Determine if application should be accepted based on flexible criteria satisfaction
    """
    satisfied_count = len(satisfied_criteria)
    
    # Calculate satisfaction percentage
    satisfaction_percentage = satisfied_count / total_criteria if total_criteria > 0 else 0
    
    # Accept if percentage threshold is met AND minimum criteria count is satisfied
    if (satisfaction_percentage >= ACCEPTANCE_PERCENTAGE_THRESHOLD and 
        satisfied_count >= MINIMUM_CRITERIA_COUNT):
        return "Accepted", satisfaction_percentage
    
    # Also accept if all criteria are satisfied (100%)
    if satisfied_count == total_criteria:
        return "Accepted", satisfaction_percentage
    
    return "Rejected", satisfaction_percentage

def check_criteria_satisfaction_detailed(resume_json, jd_json,
                                         model_high=MODEL_HIGH,
                                         model_low=MODEL_LOW,
                                         score_threshold=SCORE_THRESHOLD):
    """
    Enhanced criteria checking with type-aware evaluation and better scoring logic
    """
    criteria_list = jd_json.get("Criteria", [])
    if not criteria_list:
        return {"status": "No Criteria", "message": "No criteria found in job description"}

    satisfied_criteria = []
    rejected_criteria = []

    log.info(f"Checking {len(criteria_list)} criteria with enhanced logic...\n")

    for i, criterion in enumerate(criteria_list, 1):
        criterion = safe_str(criterion)
        log.info(f"Criterion {i}: {criterion}")
        
        # Detect criterion type
        criterion_type = detect_criterion_type(criterion)
        log.info(f"  Detected type: {criterion_type}")
        
        section_scores = []
        
        # Evaluate each resume section
        for section, content in resume_json.items():
            if not content or content in [None, "", [], {}]:
                continue
            
            score, reason = evaluate_section_for_criterion(
                section, content, criterion, criterion_type, model_high
            )
            
            section_scores.append((section, score, reason))
            log.info(f"  - Section '{section}': score={score:.2f} | {safe_str(reason)}")

        if not section_scores:
            rejection_reason = "Resume appears empty or no relevant sections to evaluate."
            rejected_criteria.append({
                "criterion": criterion,
                "criterion_type": criterion_type,
                "overall_score": 0.0,
                "matched_sections": [],
                "reason": rejection_reason
            })
            log.info(f"   NOT SATISFIED — {rejection_reason}\n")
            continue

        # Calculate overall score using type-aware aggregation
        overall_score = calculate_overall_score(section_scores, criterion_type)
        
        # Select matched sections above threshold
        matched_sections = [sec for (sec, s, _) in section_scores if s >= SECTION_MATCH_THRESHOLD]
        
        log.info(f"  => Overall score: {overall_score:.2f} (threshold: {score_threshold})")

        if overall_score >= score_threshold:
            satisfied_criteria.append({
                "criterion": criterion,
                "criterion_type": criterion_type,
                "overall_score": round(overall_score, 3),
                "matched_sections": matched_sections,
                "section_details": [
                    {"section": sec, "score": round(s, 3), "reason": safe_str(r)} 
                    for (sec, s, r) in section_scores
                ]
            })
            log.info(f"   SATISFIED (score: {overall_score:.2f})\n")
        else:
            rejection_reason = get_rejection_reason(
                criterion, criterion_type, resume_json, section_scores, model_low
            )
            rejected_criteria.append({
                "criterion": criterion,
                "criterion_type": criterion_type,
                "overall_score": round(overall_score, 3),
                "matched_sections": matched_sections,
                "reason": safe_str(rejection_reason),
                "section_details": [
                    {"section": sec, "score": round(s, 3), "reason": safe_str(r)} 
                    for (sec, s, r) in section_scores
                ]
            })
            log.info(f"   NOT SATISFIED (score: {overall_score:.2f})")
            log.info(f"   Reason: {safe_str(rejection_reason)}\n")

    # Final result formation with flexible acceptance logic
    final_status, satisfaction_percentage = determine_final_status(
        satisfied_criteria, rejected_criteria, len(criteria_list)
    )
    
    # Log the decision rationale
    log.info(f"Decision rationale:")
    log.info(f"  - Satisfied: {len(satisfied_criteria)}/{len(criteria_list)} ({satisfaction_percentage:.1%})")
    log.info(f"  - Required percentage: {ACCEPTANCE_PERCENTAGE_THRESHOLD:.1%}")
    log.info(f"  - Minimum criteria count: {MINIMUM_CRITERIA_COUNT}")
    log.info(f"  - Final status: {final_status}")
    
    if final_status == "Accepted":
        return {
            "status": "Accepted",
            "satisfaction_percentage": round(satisfaction_percentage, 3),
            "satisfied_count": len(satisfied_criteria),
            "rejected_count": len(rejected_criteria),
            "total_criteria": len(criteria_list),
            "satisfied_criteria": satisfied_criteria,
            "rejected_criteria": rejected_criteria if rejected_criteria else [],
            "acceptance_reason": f"Satisfied {len(satisfied_criteria)}/{len(criteria_list)} criteria ({satisfaction_percentage:.1%})"
        }
    else:
        return {
            "status": "Rejected",
            "satisfaction_percentage": round(satisfaction_percentage, 3),
            "satisfied_count": len(satisfied_criteria),
            "rejected_count": len(rejected_criteria),
            "total_criteria": len(criteria_list),
            "satisfied_criteria": satisfied_criteria,
            "rejected_criteria": rejected_criteria,
            "rejection_reason": f"Only satisfied {len(satisfied_criteria)}/{len(criteria_list)} criteria ({satisfaction_percentage:.1%})"
        }

# -----------------------
# Enhanced Rejection Reasoning
# -----------------------
def get_rejection_reason(criterion, criterion_type, resume_json, section_scores, model=MODEL_LOW):
    """
    Generate type-aware rejection reasons with specific improvement suggestions
    """
    # Get the best scoring sections for context
    top_sections = sorted(section_scores, key=lambda x: x[1], reverse=True)[:3]
    best_score = top_sections[0][1] if top_sections else 0.0
    
    context_summary = " | ".join([f"{sec}: {safe_str(reason)[:100]}" for sec, score, reason in top_sections])
    
    prompt = f"""
You are providing feedback to a job candidate whose resume did not meet a specific requirement.

Requirement: {safe_str(criterion)}
Requirement Type: {criterion_type}
Best Section Score: {best_score:.2f} (out of 1.0)

Evidence Found: {context_summary}

Provide a concise 1-2 sentence explanation of why the requirement wasn't fully met, followed by 1-2 specific, actionable suggestions for improvement.

Focus on:
- What's missing or insufficient
- How to strengthen their application
- Specific actions they can take

Keep response under 200 characters total.
"""
    
    try:
        raw = call_groq(model, prompt, max_tokens=100, temperature=0.2)
        return safe_str(raw).strip()[:300]  # Ensure it's not too long
    except Exception as e:
        return f"Requirement not fully satisfied. Consider strengthening relevant qualifications and experience."

def generate_comprehensive_improvement_tips(rejected_criteria):
    """
    Generate comprehensive improvement tips based on all rejected criteria
    """
    tips = []
    for criteria in rejected_criteria:
        reason = safe_str(criteria.get('reason', ''))
        if reason and not reason.startswith('Unable to determine'):
            tips.append(reason)
    
    if tips:
        combined_tips = " | ".join(tips)
        return combined_tips
    else:
        return "Consider tailoring your resume more specifically to match the job requirements. Focus on highlighting relevant experience, skills, and achievements that align with the position."

# -----------------------
# Main execution
# -----------------------
if __name__ == "__main__":
    jd_path = "jsonb.json"
    resume_path = "json3.json"

    # Get environment variables
    user_id = os.environ.get("USER_ID")
    job_id = os.environ.get("JOB_ID")

    if not user_id or not job_id:
        log.error("USER_ID and JOB_ID environment variables must be set")
        exit(1)

    log.info(f"Processing application for USER_ID: {user_id}, JOB_ID: {job_id}")

    try:
        # Read JSON files with explicit UTF-8 encoding
        with open(jd_path, "r", encoding="utf-8") as f:
            jd_json = json.load(f)

        with open(resume_path, "r", encoding="utf-8") as f:
            resume_json = json.load(f)
    except FileNotFoundError as e:
        log.error(f"Required file not found: {safe_str(e)}")
        exit(1)
    except json.JSONDecodeError as e:
        log.error(f"Invalid JSON format: {safe_str(e)}")
        exit(1)
    except UnicodeDecodeError as e:
        log.error(f"Unicode decode error: {safe_str(e)}")
        exit(1)

    safe_print("=" * 60)
    safe_print("RESUME SCREENING DETAILED REPORT")
    safe_print("=" * 60)

    result = check_criteria_satisfaction_detailed(resume_json, jd_json)

    safe_print("=" * 60)
    safe_print("FINAL RESULTS")
    safe_print("=" * 60)
    safe_print(f"Status: {result['status']}")
    safe_print(f"Satisfaction Rate: {result['satisfied_count']}/{result['total_criteria']} ({result['satisfaction_percentage']:.1%})")
    
    if result['status'] == 'Accepted':
        if result['satisfied_count'] == result['total_criteria']:
            safe_print("Perfect Match: All criteria satisfied!")
        else:
            safe_print(f"Accepted: {result.get('acceptance_reason', 'Criteria threshold met')}")
    else:
        safe_print(f"Rejected: {result.get('rejection_reason', 'Insufficient criteria satisfaction')}")

    # Handle database updates and next steps based on result
    if result['status'] == 'Rejected':
        safe_print(f"\nREJECTION REASONS:")
        safe_print("-" * 40)
        for i, rejected in enumerate(result['rejected_criteria'], 1):
            safe_print(f"{i}. Requirement: {rejected['criterion']}")
            safe_print(f"   Type: {rejected.get('criterion_type', 'general')}")
            safe_print(f"   Overall Score: {rejected.get('overall_score', 0.0)}")
            safe_print(f"   Reason: {rejected['reason']}")
            safe_print(f"   Matched Sections: {', '.join(rejected.get('matched_sections', [])) or 'None'}\n")

        if result['satisfied_criteria']:
            safe_print(f"SATISFIED REQUIREMENTS:")
            safe_print("-" * 40)
            for i, satisfied in enumerate(result['satisfied_criteria'], 1):
                safe_print(f"{i}. {satisfied['criterion']}")
                safe_print(f"   Type: {satisfied.get('criterion_type', 'general')}")
                safe_print(f"   Overall Score: {satisfied.get('overall_score')}")
                safe_print(f"   Found in: {', '.join(satisfied['matched_sections'])}\n")

        # Update database for rejected application
        log.info("Updating database for rejected application...")
        improvement_tips = generate_comprehensive_improvement_tips(result['rejected_criteria'])
        
        update_success = update_job_application_status(
            user_id=user_id,
            job_id=int(job_id),
            acceptance="rejected",
            remarks=improvement_tips
        )
        
        if update_success:
            safe_print("\nDatabase updated: Application marked as REJECTED")
        else:
            safe_print("\nFailed to update database")

    elif result['status'] == 'Accepted':
        safe_print(f"\nSATISFIED REQUIREMENTS:")
        safe_print("-" * 40)
        for i, satisfied in enumerate(result['satisfied_criteria'], 1):
            safe_print(f"{i}. {satisfied['criterion']}")
            safe_print(f"   Type: {satisfied.get('criterion_type', 'general')}")
            safe_print(f"   Found in: {', '.join(satisfied['matched_sections'])}")
            safe_print(f"   Overall Score: {satisfied.get('overall_score')}\n")
        
        # Show unsatisfied criteria if any (for partial acceptance)
        if result['rejected_criteria']:
            safe_print(f"UNSATISFIED REQUIREMENTS (Accepted despite these):")
            safe_print("-" * 40)
            for i, rejected in enumerate(result['rejected_criteria'], 1):
                safe_print(f"{i}. {rejected['criterion']}")
                safe_print(f"   Type: {rejected.get('criterion_type', 'general')}")
                safe_print(f"   Overall Score: {rejected.get('overall_score', 0.0)}")
                safe_print(f"   Reason: {rejected['reason']}\n")

        # For accepted applications, skip database update and directly run embed.py
        log.info("Resume accepted - running embed.py without database changes...")
        embed_success = run_embed_script()
        
        if embed_success:
            safe_print("\nembed.py executed successfully")
        else:
            safe_print("\nFailed to execute embed.py")

    safe_print("=" * 60)