# Formula-4-1: Resume–Job Matching Platform

This project is a full-stack application designed to parse resumes and job descriptions, compare them using embeddings & similarity metrics, and provide structured outputs with an admin dashboard.

---

## 📂 Project Structure

```
edu/
├── public/
├── server/                  # Python backend (FastAPI services)
│   ├── .env
│   ├── attempt2.py
│   ├── cosinesim.py
│   ├── criteria_checker.py
│   ├── detailed_json.py
│   ├── embed.py
│   ├── jd_parser_out.py     # JD parsing service
│   ├── parsePDF.py          # Resume parsing service
│   ├── structure_parser.py
│   ├── topK.py
│   └── requirements.txt     # Python dependencies
│
├── src/                     # Next.js (React + TypeScript) frontend
│   └── app/
│       ├── Admindash/page.tsx
│       ├── AdminJobs/[id]/page.tsx
│       ├── Home/page.tsx
│       ├── Jobs/[id]/page.tsx
│       ├── Jobs/page.tsx
│       └── Tips/page.tsx
│
├── package.json
└── globals.css
```

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the repository

```bash
git clone <repo-url>
cd edu
```

### 2️⃣ Backend Setup (Python - FastAPI)

Install dependencies:

```bash
pip install -r server/requirements.txt
```

Run the **Resume Parser service** (port 8000):

```bash
uvicorn server.parsePDF:app --reload --port 8000
```

Run the **Job Description Parser service** (port 8001):

```bash
uvicorn server.jd_parser_out:app --reload --port 8001
```

---

### 3️⃣ Frontend Setup (Next.js - TypeScript)

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Frontend will be available at **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Login Information

### 👨‍💼 Admin Login

* **Email**: `sarmahrishi04@gmail.com`
* **Password**: `abc123`

Use this to access the **Admin Dashboard**.

### 👤 User Login

* Users must **register (sign up)** first, then log in with their chosen email and password.

---

## 🚀 Workflow

1. **Backend**
   * `parsePDF.py` → Parses resumes and extracts structured data.
   * `jd_parser_out.py` → Parses job descriptions and extracts requirements.
   * `embed.py`, `cosinesim.py`, `criteria_checker.py` → Handle embeddings, similarity, and matching logic.

2. **Frontend**
   * Built using Next.js (App Router).
   * Provides dashboards for **Admin** and **Users** to manage resumes, jobs, and match results.

---

## 🛠️ Tech Stack

* **Backend**: Python, FastAPI, Uvicorn, Transformers, NLP libs
* **Frontend**: React, Next.js (TypeScript), Tailwind CSS
* **Other Tools**: Embeddings, Cosine Similarity, JSON parsing

---

## 📌 Notes

* Make sure **Python ≥ 3.9** and **Node.js ≥ 18** are installed.
* Run backend services **before** starting the frontend.
* Update `.env` file in `server/` with API keys (if required).

---
