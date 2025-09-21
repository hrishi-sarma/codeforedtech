import json, subprocess
from groq import Groq
import sys

# -----------------------
# 1) Load Resume JSON
# -----------------------
with open("json1.json", "r") as f:
    resume = json.load(f)

# -----------------------
# 2) Setup Groq Client
# -----------------------
client = Groq(api_key="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")
STRUCTURED_MODEL = "openai/gpt-oss-20b"

# -----------------------
# 3) Helper Functions
# -----------------------
def call_groq(model, prompt, max_tokens=10000, temperature=0):
    """Call Groq API with error handling"""
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an expert resume parser. Return ONLY clean, valid JSON with no duplicates or redundancy."},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"❌ API Error: {e}")
        return None

def extract_json_from_response(response):
    """Extract JSON from response, handling markdown formatting"""
    if not response:
        return None
    
    # Remove markdown formatting if present
    if response.startswith("```json"):
        response = response[7:]
    if response.endswith("```"):
        response = response[:-3]
    
    # Find JSON object boundaries
    start_idx = response.find('{')
    if start_idx == -1:
        return None
    
    # Find the matching closing brace
    brace_count = 0
    end_idx = start_idx
    
    for i, char in enumerate(response[start_idx:], start_idx):
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0:
                end_idx = i + 1
                break
    
    try:
        json_str = response[start_idx:end_idx]
        return json.loads(json_str)
    except json.JSONDecodeError:
        return None

# -----------------------
# 4) Clean Structured Parser
# -----------------------
def run_clean_structured_parser(raw_resume):
    """Parse resume cleanly - no duplicates, no mess, no missing info"""
    
    parser_prompt = f"""
You are an expert resume parser. Transform this resume JSON into a clean, well-structured format.

CRITICAL REQUIREMENTS:
1. **NO DUPLICATES** - Each piece of information should appear only once in the most appropriate section
2. **NO REDUNDANCY** - Don't repeat the same data in multiple places
3. **CLEAN STRUCTURE** - Use the exact schema provided below
4. **PRESERVE ALL INFO** - Don't lose any important details, but organize them properly
5. **NO RAW DUMPS** - Don't include raw text blocks or unprocessed data

OUTPUT SCHEMA (return exactly this structure):
{{
  "header": {{
    "name": "Full Name",
    "title": "Professional title or degree"
  }},
  "contact": {{
    "phone": "phone number",
    "email": "email address", 
    "location": "address/location",
    "linkedin": "linkedin url if available",
    "github": "github url if available",
    "website": "website url if available"
  }},
  "summary": "Professional summary if available, otherwise empty string",
  "education": [
    {{
      "institution": "School/University name",
      "degree": "Degree type",
      "field": "Field of study", 
      "graduation_date": "Graduation date",
      "gpa": "GPA if available",
      "location": "Location if available"
    }}
  ],
  "experience": [
    {{
      "company": "Company name",
      "position": "Job title/position",
      "location": "Location if available",
      "start_date": "Start date",
      "end_date": "End date", 
      "responsibilities": ["List of responsibilities/achievements as separate items"]
    }}
  ],
  "projects": [
    {{
      "name": "Project name",
      "description": "Brief description if available",
      "technologies": ["List of technologies used"],
      "start_date": "Start date if available",
      "end_date": "End date if available", 
      "achievements": ["List of key achievements/features"]
    }}
  ],
  "skills": {{
    "programming_languages": ["List of programming languages"],
    "frameworks_tools": ["List of frameworks and tools"],
    "domains": ["List of technical domains/specializations"],
    "libraries": ["List of libraries"],
    "soft_skills": ["List of soft skills"]
  }},
  "awards": [
    {{
      "name": "Award/certification name",
      "issuer": "Issuing organization",
      "date": "Date if available"
    }}
  ],
  "volunteering": [
    {{
      "organization": "Organization name",
      "role": "Role/position",
      "description": "Description of activities"
    }}
  ]
}}

PARSING RULES:
- Extract information carefully and place in the most logical section
- If education info appears in multiple places, consolidate into one clean entry
- If experience is mixed with education, separate them properly  
- Parse dates into consistent format (e.g., "July 2023", "Mar 2027")
- Clean up any OCR errors or formatting issues
- Split combined text into appropriate arrays
- Don't create duplicate entries for the same company/project/school

INPUT RESUME DATA:
{json.dumps(raw_resume, indent=2, ensure_ascii=False)}

Return ONLY the clean JSON object following the exact schema above:"""

    # Call API
    result = call_groq(STRUCTURED_MODEL, parser_prompt, max_tokens=12000, temperature=0)
    
    if not result:
        print("❌ API call failed")
        return {}
    
    # Extract and validate JSON
    parsed_result = extract_json_from_response(result)
    
    if not parsed_result:
        print("⚠️ Invalid JSON returned, attempting cleanup...")
        # Save raw response for debugging
        with open("debug_raw_response.txt", "w", encoding='utf-8') as f:
            f.write(result)
        
        # Try a simpler retry with more explicit instructions
        retry_prompt = f"""
The previous response was not valid JSON. Please fix this and return ONLY valid JSON following the exact structure.

Original resume data (extract all info but organize cleanly):
{json.dumps(raw_resume, indent=2, ensure_ascii=False)}

Required JSON structure:
{{
  "header": {{"name": "", "title": ""}},
  "contact": {{"phone": "", "email": "", "location": "", "linkedin": "", "github": "", "website": ""}},
  "summary": "",
  "education": [{{"institution": "", "degree": "", "field": "", "graduation_date": "", "gpa": "", "location": ""}}],
  "experience": [{{"company": "", "position": "", "location": "", "start_date": "", "end_date": "", "responsibilities": []}}],
  "projects": [{{"name": "", "description": "", "technologies": [], "start_date": "", "end_date": "", "achievements": []}}],
  "skills": {{"programming_languages": [], "frameworks_tools": [], "domains": [], "libraries": [], "soft_skills": []}},
  "awards": [{{"name": "", "issuer": "", "date": ""}}],
  "volunteering": [{{"organization": "", "role": "", "description": ""}}]
}}

Return only valid JSON:"""
        
        retry_result = call_groq(STRUCTURED_MODEL, retry_prompt, max_tokens=12000, temperature=0)
        parsed_result = extract_json_from_response(retry_result) if retry_result else {}
    
    return parsed_result or {}

# -----------------------
# 5) Post-processing Cleanup
# -----------------------
def clean_parsed_data(data):
    """Clean up the parsed data to remove any remaining issues"""
    if not isinstance(data, dict):
        return data
    
    # Clean up arrays - remove duplicates while preserving order
    for section in ['education', 'experience', 'projects', 'awards', 'volunteering']:
        if section in data and isinstance(data[section], list):
            # Remove duplicate entries based on key fields
            cleaned_list = []
            seen = set()
            
            for item in data[section]:
                if isinstance(item, dict):
                    # Create a key for duplicate detection based on main fields
                    if section == 'education':
                        key = f"{item.get('institution', '')}-{item.get('degree', '')}-{item.get('field', '')}"
                    elif section == 'experience':
                        key = f"{item.get('company', '')}-{item.get('position', '')}-{item.get('start_date', '')}"
                    elif section == 'projects':
                        key = f"{item.get('name', '')}-{item.get('start_date', '')}"
                    elif section == 'awards':
                        key = f"{item.get('name', '')}-{item.get('issuer', '')}"
                    elif section == 'volunteering':
                        key = f"{item.get('organization', '')}-{item.get('role', '')}"
                    else:
                        key = str(item)
                    
                    if key not in seen and key.strip('-'):  # Avoid empty keys
                        seen.add(key)
                        cleaned_list.append(item)
            
            data[section] = cleaned_list
    
    # Clean up skills section
    if 'skills' in data and isinstance(data['skills'], dict):
        for skill_type, skills in data['skills'].items():
            if isinstance(skills, list):
                # Remove duplicates while preserving order
                seen = set()
                cleaned_skills = []
                for skill in skills:
                    if isinstance(skill, str) and skill.strip() and skill.strip() not in seen:
                        seen.add(skill.strip())
                        cleaned_skills.append(skill.strip())
                data['skills'][skill_type] = cleaned_skills
    
    return data

# -----------------------
# 6) Run Clean Parser
# -----------------------
print(" Running clean structured parser...")
print("=" * 50)

try:
    structured_resume = run_clean_structured_parser(resume)
    
    if structured_resume:
        # Clean up the data
        structured_resume = clean_parsed_data(structured_resume)

        # Save the clean structured resume as json2.json
        with open("json2.json", "w", encoding='utf-8') as f:
            json.dump(structured_resume, f, indent=2, ensure_ascii=False)

        print(" Clean structured resume saved successfully!")
        print(" Output: json2.json")

        
        # Print summary statistics
        sections_count = {
            "Education entries": len(structured_resume.get('education', [])),
            "Experience entries": len(structured_resume.get('experience', [])), 
            "Projects": len(structured_resume.get('projects', [])),
            "Awards": len(structured_resume.get('awards', [])),
            "Skills categories": len([k for k, v in structured_resume.get('skills', {}).items() if v]),
            "Volunteering": len(structured_resume.get('volunteering', []))
        }
        
        print(f"\n STRUCTURED RESUME SUMMARY:")
        for section, count in sections_count.items():
            if count > 0:
                print(f"   {section}: {count}")
        
        # Verify key information is present
        has_name = bool(structured_resume.get('header', {}).get('name'))
        has_contact = bool(structured_resume.get('contact', {}).get('email'))
        has_education = bool(structured_resume.get('education'))
        has_experience = bool(structured_resume.get('experience'))
        
        print(f"\n✅ KEY INFO CHECK:")
        print(f"   Name: {'✓' if has_name else '✗'}")  
        print(f"   Contact: {'✓' if has_contact else '✗'}")
        print(f"   Education: {'✓' if has_education else '✗'}")
        print(f"   Experience: {'✓' if has_experience else '✗'}")
            
    else:
        print(" Failed to generate structured resume")
        
except Exception as e:
    print(f" Unexpected error: {e}")
    import traceback
    traceback.print_exc()

