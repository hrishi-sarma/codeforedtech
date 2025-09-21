import os, sys, re, json, argparse
from collections import defaultdict
from typing import List, Tuple, Dict
import subprocess
import sys

# optional imports
try:
    import docx
except Exception:
    docx = None

try:
    import pdfplumber
except Exception:
    pdfplumber = None

# OCR optional
try:
    import pytesseract
    from pdf2image import convert_from_path
    from PIL import Image
except Exception:
    pytesseract = None

# ---------------- ENHANCED CONFIG ----------------
HEADING_KEYWORDS = {
    "education", "experience", "work experience", "projects", "skills", "certifications",
    "publications", "awards", "achievements", "languages", "volunteer", "summary", 
    "objective", "contact", "clubs", "activities", "internships", "profile", 
    "references", "positions", "technical skills", "professional experience",
    "work history", "career", "employment", "training", "qualifications"
}

NORMALIZATION_MAP = {
    "education": ["education", "academic", "degree", "btech", "b-tech", "bachelor", "master", "university", "college", "school"],
    "experience": ["experience", "work experience", "employment", "professional experience", "work history", "career", "positions"],
    "projects": ["projects", "project"],
    "skills": ["skills", "technical skills", "domains", "libraries", "frameworks", "tools", "technologies", "programming"],
    "certifications": ["certifications", "certificates", "certificate", "training", "qualifications"],
    "awards": ["achievements", "awards", "honors", "recognition"],
    "publications": ["publications", "papers", "research"],
    "contact": ["contact", "address"],
    "summary": ["summary", "objective", "profile", "about"],
    "languages": ["languages"],
    "volunteer": ["volunteer", "community"],
    "clubs": ["clubs", "activities", "organizations", "extracurricular"],
}

# Enhanced regex patterns
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", re.UNICODE)
PHONE_RE = re.compile(r"(\+?\d[\d\-\s\(\)]{7,}\d)")
LINK_RE = re.compile(r"(https?://[^\s,;]+|www\.[^\s,;]+|linkedin\.com/[^\s,;]+|github\.com/[^\s,;]+)", re.I)
DATE_RE = re.compile(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|\d{4})[^\n,]{0,40}\b", re.I)
MONTH_YEAR_RANGE_RE = re.compile(r"(?:[A-Za-z]{3,9}\s*\d{4})\s*[-–—]\s*(?:Present|Now|Current|[A-Za-z]{3,9}\s*\d{4}|\d{4})", re.I)

# Company/Organization patterns for better experience parsing
COMPANY_INDICATORS = re.compile(r"\b(?:Inc|Corp|Corporation|Company|Ltd|Limited|LLC|Technologies|Institute|University|College)\b", re.I)

# ----------------- Helpers: IO / text extraction -----------------
def read_docx(path: str) -> List[Tuple[bool, str]]:
    if docx is None:
        raise RuntimeError("python-docx not installed. run: pip install python-docx")
    doc = docx.Document(path)
    out = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        style = ""
        try:
            style = (para.style.name or "").lower()
        except Exception:
            style = ""
        is_heading = style.startswith("heading")
        if not is_heading:
            for run in para.runs:
                try:
                    if run.bold and len(text.split()) <= 7:
                        is_heading = True
                        break
                except Exception:
                    pass
        out.append((is_heading, text))
    return out

def read_pdf(path: str) -> List[Tuple[bool, str]]:
    if pdfplumber is None:
        raise RuntimeError("pdfplumber not installed. run: pip install pdfplumber")
    pages = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            try:
                txt = p.extract_text()
            except Exception:
                txt = None
            if txt and txt.strip():
                for line in txt.split("\n"):
                    s = line.strip()
                    if s:
                        pages.append((False, s))
            else:
                pages.append((False, None))
    
    # OCR fallback for scanned PDFs
    if any(t is None for _, t in pages):
        if pytesseract is None:
            raise RuntimeError("Scanned PDF detected: install pytesseract & pdf2image for OCR fallback.")
        ocr_lines = []
        images = convert_from_path(path, dpi=300)
        for img in images:
            txt = pytesseract.image_to_string(img)
            for line in txt.split("\n"):
                s = line.strip()
                if s:
                    ocr_lines.append((False, s))
        return ocr_lines
    return pages

# ----------------- Enhanced Cleaning -----------------
def clean_zero_width_and_weird_spaces(s: str) -> str:
    if not s:
        return s
    s = s.replace("\u200b", "")  # zero-width space
    s = s.replace("\xa0", " ")   # non-breaking space
    s = s.replace("\u2022", "•") # normalize bullet points
    s = re.sub(r"\s+", " ", s)   # collapse multiple spaces
    return s.strip()

def fix_broken_email_like(text: str) -> str:
    # Fix broken emails like "name @ domain . com"
    t = re.sub(r"\s*@\s*", "@", text)
    t = re.sub(r"(\w)\s*\.\s*(\w)", r"\1.\2", t)  # Fix broken domains
    t = re.sub(r"\s+", " ", t)
    return t

# ----------------- Enhanced Heading Detection -----------------
def is_heading_text(line: str, next_line: str = None, prev_line: str = None) -> bool:
    if not line:
        return False
    
    s = line.strip()
    low = s.lower()
    words = s.split()
    
    # Exact matches for common resume sections (ALL CAPS)
    exact_headings = {
        "summary", "education", "experience", "projects", "skills", 
        "achievements", "awards", "certifications", "languages",
        "volunteer", "activities", "references", "contact"
    }
    
    if low in exact_headings or s.upper() in [h.upper() for h in exact_headings]:
        return True
    
    # Strong heading indicators
    for kw in HEADING_KEYWORDS:
        if low == kw or (len(words) == 1 and kw in low):
            return True
    
    # Line ends with colon
    if s.endswith(":"):
        return True
    
    # ALL CAPS short line (common in resumes) - be more restrictive
    if (s == s.upper() and 1 <= len(words) <= 3 and len(s) <= 50 and
        not any(char.isdigit() for char in s) and 
        not any(char in s for char in ['@', '.com', '+', '|', '-'])):
        return True
    
    # Don't treat company names or project names as headings unless they're clearly section headers
    # Avoid treating lines with bullets, dates, or descriptive content as headings
    if (any(char in s for char in ['•', '·', '-']) or 
        MONTH_YEAR_RANGE_RE.search(s) or
        'github' in low or 'link' in low):
        return False
    
    return False

def normalize_heading(h: str) -> str:
    if not h: 
        return "other"
    
    h_low = h.lower().strip()
    
    # Direct keyword matching
    for canon, variants in NORMALIZATION_MAP.items():
        for v in variants:
            if v in h_low:
                return canon
    
    # Special case handling
    if any(word in h_low for word in ["intern", "trainee", "engineer", "developer", "analyst"]):
        return "experience"
    
    if any(word in h_low for word in ["project", "portfolio"]):
        return "projects"
    
    # Fallback: cleaned token
    cleaned = re.sub(r"[^A-Za-z0-9 ]+", " ", h).strip().lower()
    cleaned = re.sub(r"\s+", " ", cleaned)
    
    return cleaned or "other"

def segment_sections(lines: List[Tuple[bool, str]]) -> Dict[str, str]:
    sections = defaultdict(list)
    current = "header"
    
    for i, (is_head, text) in enumerate(lines):
        if not text:
            continue
            
        # Get context for better heading detection
        next_line = lines[i+1][1] if i+1 < len(lines) else None
        prev_line = lines[i-1][1] if i-1 >= 0 else None
        
        # Check if this should be treated as a heading
        if is_head or is_heading_text(text, next_line, prev_line):
            key = normalize_heading(text)
            current = key
            # Don't include the heading text itself in the section content
            continue
            
        # Special handling for known section patterns
        text_lower = text.lower().strip()
        
        # Skip company headers that aren't actual section headings
        # But capture them in the appropriate section (experience vs projects)
        if (COMPANY_INDICATORS.search(text) and len(text.split()) <= 8 and
            not text.startswith(('•', '·', '-'))):
            # This might be a company name - keep it in current section
            pass
        
        sections[current].append(text)
    
    # Convert to joined text and filter empty sections
    result = {}
    for k, v in sections.items():
        if v:
            content = "\n".join(v).strip()
            if content:
                result[k] = content
    
    # Post-process to fix common issues
    result = post_process_sections(result)
    return result

def post_process_sections(sections: Dict[str, str]) -> Dict[str, str]:
    """Fix common section misalignments"""
    
    # Look for experience content that ended up in wrong sections
    experience_indicators = ['intern', 'engineer', 'trainee', 'developer', 'analyst', 'manager']
    project_indicators = ['github', 'project link', 'tech stack']
    
    # Check if projects ended up in experience section
    if 'experience' in sections:
        exp_content = sections['experience']
        if any(indicator in exp_content.lower() for indicator in project_indicators):
            # Split content to separate actual experience from projects
            lines = exp_content.split('\n')
            exp_lines = []
            project_lines = []
            
            in_project_section = False
            
            for line in lines:
                line_lower = line.lower()
                if any(indicator in line_lower for indicator in project_indicators):
                    in_project_section = True
                elif any(indicator in line_lower for indicator in experience_indicators) and not in_project_section:
                    in_project_section = False
                
                if in_project_section:
                    project_lines.append(line)
                else:
                    exp_lines.append(line)
            
            # Update sections
            if exp_lines:
                sections['experience'] = '\n'.join(exp_lines).strip()
            if project_lines:
                if 'projects' not in sections:
                    sections['projects'] = '\n'.join(project_lines).strip()
                else:
                    sections['projects'] += '\n' + '\n'.join(project_lines).strip()
    
    # Check if experience content ended up in skills or other sections
    sections_to_update = {}
    sections_to_delete = []

    for section_name, content in list(sections.items()):
        if section_name not in ['experience', 'projects']:
            lines = content.split('\n')
            section_lines = []
            exp_lines = []
            
            for line in lines:
                line_lower = line.lower()
                # Check for experience patterns
                if (any(indicator in line_lower for indicator in experience_indicators) or
                    MONTH_YEAR_RANGE_RE.search(line) or
                    COMPANY_INDICATORS.search(line)):
                    exp_lines.append(line)
                else:
                    section_lines.append(line)
            
            if exp_lines:
                # Move experience content to experience section
                if 'experience' not in sections:
                    sections_to_update['experience'] = '\n'.join(exp_lines).strip()
                else:
                    sections_to_update['experience'] = sections['experience'] + '\n' + '\n'.join(exp_lines).strip()
                
                # Update current section with remaining content
                if section_lines:
                    sections_to_update[section_name] = '\n'.join(section_lines).strip()
                else:
                    # Mark section for deletion
                    sections_to_delete.append(section_name)

    # Apply updates after iteration is complete
    for section_name, content in sections_to_update.items():
        sections[section_name] = content

    for section_name in sections_to_delete:
        if section_name in sections:
            del sections[section_name]

    return sections

# ----------------- Enhanced Contact Extraction -----------------
def extract_contact_from_text(text: str, top_lines: List[str] = None) -> Dict:
    if not text:
        return {"emails": [], "phones": [], "links": []}
    
    # Clean text for email extraction
    cleaned_for_email = fix_broken_email_like(text)
    cleaned_for_email = clean_zero_width_and_weird_spaces(cleaned_for_email)
    
    emails = EMAIL_RE.findall(cleaned_for_email)
    phones = PHONE_RE.findall(text)
    links = LINK_RE.findall(text)
    
    # Also search in header lines
    if top_lines:
        header_text = " ".join(top_lines)
        cleaned_header = fix_broken_email_like(header_text)
        emails += EMAIL_RE.findall(cleaned_header)
        phones += PHONE_RE.findall(header_text)
        links += LINK_RE.findall(header_text)
    
    # Normalize and deduplicate
    emails = sorted(set(e.strip().lower() for e in emails))
    
    phones_norm = []
    for p in phones:
        s = re.sub(r"[^\d+]", "", p)
        if 7 <= len(re.sub(r"\D", "", s)) <= 15:
            phones_norm.append(s)
    phones_norm = sorted(set(phones_norm))
    
    links_norm = []
    for l in links:
        l = l.strip()
        if not l.lower().startswith("http"):
            l = "https://" + l
        links_norm.append(l)
    links_norm = sorted(set(links_norm))
    
    return {"emails": emails, "phones": phones_norm, "links": links_norm}

def extract_header_info(lines: List[str]) -> Dict:
    header_lines = lines[:15]  # Look at more lines for name detection
    
    name = None
    for l in header_lines:
        # Skip lines with digits (likely contact info)
        if any(ch.isdigit() for ch in l):
            continue
        
        # Skip lines with @ symbol (emails)
        if '@' in l:
            continue
            
        # Skip lines with common contact keywords
        if any(word in l.lower() for word in ['phone', 'email', 'linkedin', 'github', 'address']):
            continue
        
        words = [w for w in l.split() if w]
        
        # Look for potential names (2-4 words, properly capitalized)
        if 2 <= len(words) <= 4 and all(re.match(r"[A-Za-z].*", w) for w in words):
            # Prefer ALL CAPS or Title Case
            if (l == l.upper() or 
                all(w[0].isupper() for w in words if w and w[0].isalpha())):
                name = l.strip()
                break
    
    return {"name": name, "top_lines": header_lines}

# ----------------- Enhanced Structured Parsing -----------------
def split_into_items_by_patterns(text: str, section_type: str = "general") -> List[str]:
    """Split text into items using patterns specific to section type"""
    
    if section_type == "projects":
        # For projects, look for project name patterns
        patterns = [
            r'^[A-Z][A-Za-z0-9\s.]+ [-|–] [A-Za-z\s]+.*?(?=^[A-Z][A-Za-z0-9\s.]+ [-|–] [A-Za-z\s]+|\Z)',
            r'^[A-Z][A-Za-z0-9\s.]+\s*\|\s*Project Link:.*?(?=^[A-Z][A-Za-z0-9\s.]+\s*\|\s*Project Link:|\Z)',
        ]
        
        # Try regex-based splitting first
        for pattern in patterns:
            matches = re.findall(pattern, text, re.MULTILINE | re.DOTALL)
            if len(matches) > 1:
                return [m.strip() for m in matches if m.strip()]
    
    elif section_type == "experience":
        # For experience, look for company name patterns
        lines = text.split('\n')
        blocks = []
        current_block = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check if line looks like a new experience entry
            is_new_entry = False
            
            # Company name patterns
            if (COMPANY_INDICATORS.search(line) and 
                len(line.split()) <= 10 and 
                not line.startswith(('•', '·', '-', 'Tech Stack'))):
                is_new_entry = True
            
            # Role title patterns (without bullets)
            elif (any(role in line.lower() for role in ['intern', 'engineer', 'trainee', 'developer', 'analyst', 'manager']) and
                  len(line.split()) <= 12 and
                  not line.startswith(('•', '·', '-', 'Tech Stack')) and
                  not 'github' in line.lower()):
                is_new_entry = True
            
            if is_new_entry and current_block:
                blocks.append('\n'.join(current_block))
                current_block = [line]
            else:
                current_block.append(line)
        
        if current_block:
            blocks.append('\n'.join(current_block))
        
        if len(blocks) > 1:
            return [b.strip() for b in blocks if b.strip()]
    
    # Fallback: split by double newlines
    blocks = re.split(r"\n\s*\n+", text.strip())
    return [b.strip() for b in blocks if b.strip()]

def parse_project_block(block: str) -> Dict:
    lines = [l.strip() for l in block.split("\n") if l.strip()]
    if not lines:
        return {"name": None, "dates": None, "technologies": None, "bullets": []}
    
    item = {"name": None, "dates": None, "technologies": None, "bullets": []}
    
    # First line is usually the project name/title
    first_line = lines[0]
    item["name"] = first_line
    
    # Extract dates from first line or subsequent lines
    date_match = MONTH_YEAR_RANGE_RE.search(first_line)
    if date_match:
        item["dates"] = date_match.group(0).strip()
    else:
        # Look in next few lines for dates
        for line in lines[1:3]:
            date_match = MONTH_YEAR_RANGE_RE.search(line)
            if date_match:
                item["dates"] = date_match.group(0).strip()
                break
    
    # Look for technology/tech stack information
    tech_patterns = [
        r"tech\s*stack[:\s]*(.+)",
        r"technolog(?:y|ies)[:\s]*(.+)",
        r"built\s*with[:\s]*(.+)",
        r"using[:\s]*(.+)"
    ]
    
    for line in lines:
        for pattern in tech_patterns:
            match = re.search(pattern, line, re.I)
            if match:
                item["technologies"] = match.group(1).strip()
                break
        if item["technologies"]:
            break
    
    # Collect bullet points (lines starting with bullet markers or descriptive content)
    bullets = []
    for line in lines[1:]:  # Skip first line (name)
        if line == item.get("technologies", ""):  # Skip tech line
            continue
        if item.get("dates") and item["dates"] in line:  # Skip date line
            continue
        
        # Check if it's a bullet point or descriptive line
        if (line.startswith(('•', '-', '*', '·')) or 
            len(line.split()) > 6):  # Long descriptive lines
            bullet_text = line.lstrip('•-*· ').strip()
            if bullet_text:
                bullets.append(bullet_text)
    
    item["bullets"] = bullets
    return item

def parse_experience_block(block: str) -> Dict:
    lines = [l.strip() for l in block.split("\n") if l.strip()]
    if not lines:
        return {"role": None, "company": None, "dates": None, "bullets": []}
    
    item = {"role": None, "company": None, "dates": None, "bullets": []}
    
    # Skip if this looks like a project (has GitHub, Project Link, Tech Stack indicators)
    block_lower = block.lower()
    if any(indicator in block_lower for indicator in ['github', 'project link', 'tech stack']):
        return {"role": None, "company": None, "dates": None, "bullets": [], "skip": True}
    
    # Find the company line (usually contains company indicators)
    company_line_idx = None
    role_line_idx = None
    
    for i, line in enumerate(lines):
        if COMPANY_INDICATORS.search(line) and not line.startswith(('•', '·', '-')):
            company_line_idx = i
            item["company"] = line.strip()
            break
    
    # Look for role line (usually follows company line)
    if company_line_idx is not None and company_line_idx + 1 < len(lines):
        next_line = lines[company_line_idx + 1]
        if not next_line.startswith(('•', '·', '-')):
            item["role"] = next_line.strip()
            role_line_idx = company_line_idx + 1
    
    # If no clear company found, try pattern matching
    if not item["company"]:
        header_lines = []
        bullet_start_idx = 0
        
        for i, line in enumerate(lines):
            if line.startswith(('•', '-', '*', '·')):
                bullet_start_idx = i
                break
            header_lines.append(line)
        
        if not bullet_start_idx:
            bullet_start_idx = min(3, len(lines))
            header_lines = lines[:bullet_start_idx]
        
        # Parse header information
        header_text = " ".join(header_lines)
        
        # Extract dates first
        date_match = MONTH_YEAR_RANGE_RE.search(header_text)
        if date_match:
            item["dates"] = date_match.group(0).strip()
            header_text = header_text.replace(item["dates"], "").strip()
        
        # Try different patterns to extract role and company
        patterns = [
            r"^(.+?)\s+[-–—]\s+(.+?)(?:\s+\w+,?\s+\w+)?$",
            r"^(.+?)\s+at\s+(.+?)(?:\s+\w+,?\s+\w+)?$",
            r"^(.+?)\s+\|\s+(.+?)(?:\s+\w+,?\s+\w+)?$",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, header_text, re.I)
            if match:
                potential_role = match.group(1).strip()
                potential_company = match.group(2).strip()
                
                if COMPANY_INDICATORS.search(potential_company):
                    item["role"] = potential_role
                    item["company"] = potential_company
                else:
                    item["role"] = potential_role
                    item["company"] = potential_company
                break
        
        bullet_start_idx = len(header_lines)
    else:
        bullet_start_idx = (role_line_idx or company_line_idx) + 1
    
    # Extract dates if not already found
    if not item["dates"]:
        for line in lines[:bullet_start_idx]:
            date_match = MONTH_YEAR_RANGE_RE.search(line)
            if date_match:
                item["dates"] = date_match.group(0).strip()
                break
    
    # Extract bullet points
    bullets = []
    for line in lines[bullet_start_idx:]:
        if line.startswith(('•', '-', '*', '·')):
            bullet_text = line.lstrip('•-*· ').strip()
            if bullet_text:
                bullets.append(bullet_text)
        elif len(line.split()) > 6:  # Long descriptive lines
            bullets.append(line)
    
    item["bullets"] = bullets
    return item

# ----------------- Main Flow -----------------
def build_raw_text(lines: List[Tuple[bool, str]]) -> str:
    return "\n".join([clean_zero_width_and_weird_spaces(t) for _, t in lines if t])

def parse_resume(path: str) -> Dict:
    ext = os.path.splitext(path)[1].lower()
    if ext in (".docx",):
        lines = read_docx(path)
    elif ext in (".pdf",):
        lines = read_pdf(path)
    else:
        raise RuntimeError("Unsupported file type: use .pdf or .docx")

    # Clean hyphenation and zero-width characters
    cleaned = []
    i = 0
    while i < len(lines):
        is_head, text = lines[i]
        if text and text.endswith("-") and i+1 < len(lines):
            nxt = lines[i+1][1] or ""
            merged = text[:-1] + nxt
            cleaned.append((is_head, clean_zero_width_and_weird_spaces(merged)))
            i += 2
        else:
            cleaned.append((is_head, clean_zero_width_and_weird_spaces(text) if text else text))
            i += 1
    lines = cleaned

    # Build components
    raw_text = build_raw_text(lines)
    top_n_lines = [t for _, t in lines if t][:15]
    header_info = extract_header_info(top_n_lines)
    contact = extract_contact_from_text(raw_text, top_lines=top_n_lines)
    sections = segment_sections(lines)

    # Structured parsing for projects & experience
    structured = {}
    
    if "projects" in sections:
        items = []
        for block in split_into_items_by_patterns(sections["projects"], "projects"):
            parsed = parse_project_block(block)
            items.append(parsed)
        structured["projects"] = items
    
    if "experience" in sections:
        items = []
        for block in split_into_items_by_patterns(sections["experience"], "experience"):
            parsed = parse_experience_block(block)
            # Skip items that are actually projects
            if not parsed.get("skip", False):
                items.append(parsed)
        # Remove the skip key from remaining items
        for item in items:
            item.pop("skip", None)
        structured["experience"] = items

    result = {
        "file": os.path.basename(path),
        "header": {"name": header_info.get("name")},
        "contact": contact,
        "sections": sections,
        "structured": structured,
        "raw_text": raw_text
    }
    return result

# ---------------- CLI ----------------
def parse_args():
    p = argparse.ArgumentParser(description="Enhanced Resume Parser -> JSON")
    p.add_argument("input", help="path to resume (.pdf or .docx)")
    p.add_argument("-o", "--output", default=None, help="output json file")
    p.add_argument("--debug", action="store_true", help="enable debug output")
    return p.parse_args()

import subprocess

def main():
    args = parse_args()
    
    # Convert relative path to absolute path
    input_path = os.path.abspath(args.input)
    
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Original input: {args.input}")
        sys.exit(2)
    
    try:
        res = parse_resume(input_path)
    except Exception as e:
        print("Error parsing resume:", e)
        if args.debug:
            raise
        sys.exit(1)
    
    out_path = args.output or ("json1.json")
    
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully parsed resume and wrote JSON to {out_path}")
    
    # Print summary
    if args.debug:
        print("\n=== PARSING SUMMARY ===")
        print(f"Name: {res['header']['name']}")
        print(f"Sections found: {list(res['sections'].keys())}")
        if 'projects' in res['structured']:
            print(f"Projects parsed: {len(res['structured']['projects'])}")
        if 'experience' in res['structured']:
            print(f"Experience items parsed: {len(res['structured']['experience'])}")

if __name__ == "__main__":
    main()