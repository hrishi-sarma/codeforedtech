# 🚀 Automated Resume Relevance Check System  

## 📌 Overview  
This project is built under **Theme 2 – Automated Resume Relevance Check System** for **Innomatics Research Labs**.  

Every week, the placement team receives **18–20 job requirements** across Hyderabad, Bangalore, Pune, and Delhi NCR. Each job attracts **hundreds or thousands of applications**.  

Currently, resumes are checked **manually**, which causes:  
- ⏳ **Delays** in shortlisting candidates.  
- ⚖️ **Inconsistency**, since recruiters interpret requirements differently.  
- 🏋️ **High workload** for placement staff.  

Our system solves this by providing an **AI-powered, automated, and scalable resume relevance engine**.  

---

## 🎯 Objectives  
The system aims to:  
- Automate **resume evaluation** against job descriptions.  
- Generate a **Relevance Score (0–100)**.  
- Classify candidates into **High / Medium / Low suitability**.  
- Highlight **missing skills, projects, and certifications**.  
- Provide **personalized improvement tips** to students.  
- Store results in a **dashboard** for recruiters.  

---

## 🏗️ System Architecture  

```mermaid
flowchart TD
    A[Admin Uploads JD] --> B[JD Parsing & JSON Conversion]
    B --> C[Stored in Supabase]
    D[Student Uploads Resume] --> E[Resume Parsing & JSON Conversion]
    E --> F[Structured Resume JSON]
    F --> G[AI Screening Engine]
    C --> G
    G --> H[Relevance Scoring]
    H --> I[Database Update - Supabase]
    I --> J[Admin Dashboard: Shortlisted Candidates]
    I --> K[Student Dashboard: Feedback & Tips]
