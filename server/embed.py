import json
import os
from dotenv import load_dotenv
from huggingface_hub import login
from sentence_transformers import SentenceTransformer
import torch
import faiss
import numpy as np
import subprocess
import sys  # <-- for running cosiness.py with the same interpreter

# ---------- ENV & TOKEN ----------
load_dotenv()
hf_token = os.getenv("HF_TOKEN")
if hf_token:
    print(" Using Hugging Face token from .env")
    login(token=hf_token)
else:
    print(" No HF_TOKEN found in .env — trying anonymous download...")

# ---------- MODEL ----------
model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
torch.set_num_threads(1)        # single-threaded PyTorch
embedding_dim = model.get_sentence_embedding_dimension()
faiss.omp_set_num_threads(1)    # single-threaded FAISS

# ---------- UTILS ----------
def flatten(value):
    if isinstance(value, str):
        return value.strip()
    elif isinstance(value, list):
        return " ".join(flatten(v) for v in value)
    elif isinstance(value, dict):
        return " ".join(f"{k}: {flatten(v)}" for k, v in value.items())
    else:
        return str(value)

def generate_embeddings_from_json(data_json):
    embeddings = {}
    for section, value in data_json.items():
        text_content = flatten(value)
        if text_content.strip():
            emb = model.encode(text_content, convert_to_numpy=True)
            embeddings[section] = {"text": text_content, "embedding": emb}
    return embeddings

def generate_combined_embedding(data_json):
    full_text = flatten(data_json)
    emb = model.encode(full_text, convert_to_numpy=True)
    return {"text": full_text, "embedding": emb}

def store_in_faiss(embeddings_dict, index_path):
    vectors = []
    metadata = []

    for section, data in embeddings_dict.items():
        emb = data["embedding"]
        # Normalize for cosine similarity
        emb = emb / np.linalg.norm(emb)
        vectors.append(emb)
        metadata.append({"section": section, "text": data["text"]})

    vectors = np.vstack(vectors).astype("float32")
    
    # Use inner product index for cosine similarity
    index = faiss.IndexFlatIP(embedding_dim)
    index.add(vectors)

    # Save FAISS index and metadata
    faiss.write_index(index, index_path)
    with open(index_path.replace(".index", "_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f" Stored {len(metadata)} embeddings (normalized for cosine similarity) in {index_path}")

# ---------- MAIN SCRIPT ----------
if __name__ == "__main__":
    # ----- Process Resume -----
    with open("json3.json", "r", encoding="utf-8") as f:
        resume_data = json.load(f)
    resume_embeddings = generate_embeddings_from_json(resume_data)
    resume_embeddings["_combined"] = generate_combined_embedding(resume_data)
    with open("resume_section_embeddings.json", "w", encoding="utf-8") as f:
        json.dump({k: {"text": v["text"], "embedding": v["embedding"].tolist()} 
                   for k, v in resume_embeddings.items()}, f, indent=2, ensure_ascii=False)
        
    store_in_faiss(resume_embeddings, "resume_embeddings.index")
    
    # ----- Process Job Description -----
    with open("jsonb.json", "r", encoding="utf-8") as f:
        jd_data = json.load(f)
    jd_embeddings = generate_embeddings_from_json(jd_data)
    jd_embeddings["_combined"] = generate_combined_embedding(jd_data)
    
    with open("job_description_embeddings.json", "w", encoding="utf-8") as f:
        json.dump({k: {"text": v["text"], "embedding": v["embedding"].tolist()} 
                   for k, v in jd_embeddings.items()}, f, indent=2, ensure_ascii=False)
    store_in_faiss(jd_embeddings, "job_description_embeddings.index")

    print("\n Resume & Job Description embeddings are generated and stored in FAISS successfully!")

    # ----- AUTO RUN cosiness.py WITH ENVIRONMENT VARIABLES -----
    print("\n Running cosinesim.py automatically with environment variables...")
    
    # Get current environment to forward all variables including USER_ID and JOB_ID
    env = os.environ.copy()
    
    subprocess.run([sys.executable, "cosinesim.py"], env=env, encoding='utf-8', errors='replace')