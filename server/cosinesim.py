import faiss
import json
import numpy as np
import os
from typing import Dict, Any
from supabase import create_client, Client

class ResumeJDSimilarityMatcher:
    def __init__(self, resume_index_path: str, resume_metadata_path: str,
                 jd_index_path: str, jd_metadata_path: str):
        # Initialize Supabase
        self.supabase_url = "https://iplkewjfgukcflkajmzz.supabase.co"  # Replace with your Supabase URL
        self.supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwbGtld2pmZ3VrY2Zsa2FqbXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzMDM1NjMsImV4cCI6MjA3Mzg3OTU2M30.Uu8odziaWjN9aKCmVF2klXAip3Y8woJ6t66XztYQuD0"  # Replace with your Supabase anon key
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Get environment variables
        self.user_id = os.environ.get("USER_ID")
        self.job_id = os.environ.get("JOB_ID")
        
        if not self.user_id or not self.job_id:
            raise ValueError("USER_ID and JOB_ID environment variables must be set")
        
        print(f"Processing similarity analysis for USER_ID: {self.user_id}, JOB_ID: {self.job_id}")
        
        # Load FAISS indices
        self.resume_index = faiss.read_index(resume_index_path)
        self.jd_index = faiss.read_index(jd_index_path)
        
        # Load resume metadata
        with open(resume_metadata_path, 'r', encoding='utf-8') as f:
            self.resume_metadata = json.load(f)
        
        # Load JD metadata (this should be the metadata file, not the original JSON)
        with open(jd_metadata_path, 'r', encoding='utf-8') as f:
            self.jd_metadata = json.load(f)
        
        print(f"Loaded resume index with {self.resume_index.ntotal} vectors")
        print(f"Loaded JD index with {self.jd_index.ntotal} vectors")
        print(f"Loaded {len(self.jd_metadata)} JD sections from metadata")
    
    def get_all_vectors_from_index(self, index: faiss.Index) -> np.ndarray:
        n_vectors = index.ntotal
        if n_vectors == 0:
            return np.zeros((0, 768), dtype=np.float32)
        return index.reconstruct_n(0, n_vectors)

    def compute_cosine_similarity_matrix(self, A: np.ndarray, B: np.ndarray) -> np.ndarray:
        if A.size == 0 or B.size == 0:
            return np.zeros((A.shape[0], B.shape[0]))
        # Since vectors are already normalized in FAISS, dot product gives cosine similarity
        return A @ B.T

    def calculate_section_scores(self, results: Dict[str, Any]) -> Dict[str, float]:
        """Calculate percentage scores for specific sections"""
        section_scores = {
            'experience': 0.0,
            'skills': 0.0,
            'education': 0.0
        }
        
        # Map section names to categories
        section_mapping = {
            'experience': ['experience', 'work', 'employment', 'career', 'professional'],
            'skills': ['skills', 'skill', 'technical', 'technologies', 'tools', 'programming'],
            'education': ['education', 'qualification', 'degree', 'university', 'college', 'academic']
        }
        
        section_matches = results.get('section_matches', {})
        
        for category, keywords in section_mapping.items():
            scores = []
            for section_name, section_data in section_matches.items():
                section_name_lower = section_name.lower()
                
                # Check if this section matches any keywords for this category
                if any(keyword in section_name_lower for keyword in keywords):
                    score = section_data.get('overall_similarity_score', 0.0)
                    scores.append(score)
            
            # Calculate average score for this category and convert to percentage
            if scores:
                section_scores[category] = round(np.mean(scores) * 100, 2)
            else:
                section_scores[category] = 0.0
        
        return section_scores

    def generate_improvement_tips(self, section_scores: Dict[str, float]) -> str:
        """Generate personalized improvement tips based on scores"""
        tips = []
        
        # Experience improvement tips
        if section_scores['experience'] < 70:
            tips.append("Experience: Consider highlighting specific achievements, quantifiable results, and relevant work projects that align with job requirements.")
        
        # Skills improvement tips  
        if section_scores['skills'] < 70:
            tips.append("Skills: Add more technical skills, certifications, or tools mentioned in the job description. Include proficiency levels and practical examples.")
            
        # Education improvement tips
        if section_scores['education'] < 70:
            tips.append("Education: Include relevant coursework, projects, certifications, or additional training that relates to the position.")
        
        # General tips based on overall performance
        if max(section_scores.values()) < 60:
            tips.append("Overall: Tailor your resume more specifically to match the job requirements using similar keywords and terminology.")
        
        if len(tips) == 0:
            tips.append("Strong profile! Consider adding more specific examples and quantifiable achievements to further strengthen your application.")
        
        return " ".join(tips)

    def update_database(self, results: Dict[str, Any]):
        """Update job_applications table with calculated scores, acceptance status, and improvement tips"""
        try:
            # Calculate section-specific scores
            section_scores = self.calculate_section_scores(results)
            
            # Get overall scores
            overall_summary = results.get('overall_summary', {})
            
            # Calculate hireability percentage (weighted average of key metrics)
            cumulative_weighted_score = overall_summary.get('cumulative_weighted_score', 0.0)
            hireability_percentage = round(min(cumulative_weighted_score * 100, 100.0), 2)
            
            # Calculate total score (average of all section scores and overall similarity)
            mean_similarity = overall_summary.get('mean_similarity', 0.0)
            all_scores = [
                section_scores['experience'] / 100,
                section_scores['skills'] / 100,
                section_scores['education'] / 100,
                mean_similarity
            ]
            total_score = round(np.mean([s for s in all_scores if s > 0]) * 100, 2)
            
            # Generate improvement tips
            improvement_tips = self.generate_improvement_tips(section_scores)
            
            # Update database
            update_data = {
                'hireability_percentage': hireability_percentage,
                'experience': section_scores['experience'],
                'skills': section_scores['skills'],
                'education': section_scores['education'],
                'total_score': total_score,
                'acceptance': 'pending',
                'remarks': improvement_tips
            }
            
            result = self.supabase.table('job_applications').update(update_data).eq(
                'user_id', self.user_id
            ).eq('job_id', int(self.job_id)).execute()
            
            print(f"\n=== Database Update Successful ===")
            print(f"USER_ID: {self.user_id}, JOB_ID: {self.job_id}")
            print(f"Acceptance Status: pending")
            print(f"Hireability Percentage: {hireability_percentage}%")
            print(f"Experience Score: {section_scores['experience']}%")
            print(f"Skills Score: {section_scores['skills']}%")
            print(f"Education Score: {section_scores['education']}%")
            print(f"Total Score: {total_score}%")
            print(f"Improvement Tips: {improvement_tips}")
            
            return True
            
        except Exception as e:
            print(f"Database update failed: {e}")
            return False

    def find_best_matches_vectorized(self, top_k: int = 5) -> Dict[str, Any]:
        resume_vectors = self.get_all_vectors_from_index(self.resume_index)
        jd_vectors = self.get_all_vectors_from_index(self.jd_index)
        similarity_matrix = self.compute_cosine_similarity_matrix(resume_vectors, jd_vectors)

        results = {'section_matches': {}, 'overall_summary': {}}
        all_scores = []
        weighted_scores = []
        
        # Define weights - made case-insensitive and more flexible matching
        weights_mapping = {
            'experience': 3.0,
            'work': 3.0,
            'employment': 3.0,
            'certifications': 2.0,
            'certification': 2.0,
            'skills': 1.5,
            'skill': 1.5,
            'technical': 1.5,
            'education': 2.0,
            'projects': 2.0,
            'project': 2.0
        }

        for resume_idx, resume_section in enumerate(self.resume_metadata):
            # Fix: Use 'section' instead of 'section_name' to match your metadata structure
            resume_name = resume_section.get('section', f'Section_{resume_idx}').lower()
            resume_text = resume_section.get('text', 'No text available')

            if similarity_matrix.shape[1] == 0:
                overall_score = 0.0
                top_indices = []
            else:
                overall_score = float(np.max(similarity_matrix[resume_idx]))
                top_indices = np.argsort(-similarity_matrix[resume_idx])[:top_k]

            best_matches = []
            for rank, jd_idx in enumerate(top_indices, 1):
                jd_section = self.jd_metadata[jd_idx]
                # Fix: Use 'section' instead of 'section_name'
                jd_name = jd_section.get('section', f'JD_Section_{jd_idx}')
                jd_text = jd_section.get('text', 'No text available')
                score = float(similarity_matrix[resume_idx, jd_idx])

                best_matches.append({
                    'rank': rank,
                    'jd_section_name': jd_name,
                    'similarity_score': score,
                    'jd_text_preview': jd_text[:150] + "..." if len(jd_text) > 150 else jd_text
                })

            # Determine weight - more flexible matching
            weight = 1.0
            resume_name_lower = resume_name.lower()
            for key in weights_mapping:
                if key in resume_name_lower:
                    weight = weights_mapping[key]
                    break

            weighted_scores.append(overall_score * weight)
            all_scores.append(overall_score)

            results['section_matches'][resume_name] = {
                'resume_text_preview': resume_text[:200] + "..." if len(resume_text) > 200 else resume_text,
                'best_matches': best_matches,
                'overall_similarity_score': overall_score,
                'weight': weight,
                'section_type': resume_name  # Added for debugging
            }

        # Overall summary
        if all_scores:
            # Fix: Use 'section' for weight calculation
            total_weight = sum([
                weights_mapping.get(
                    next((key for key in weights_mapping.keys() 
                         if key in sec.get('section', '').lower()), 'default'), 1.0
                ) for sec in self.resume_metadata
            ])
            cumulative_score = sum(weighted_scores) / total_weight if total_weight > 0 else 0.0

            results['overall_summary'] = {
                'mean_similarity': float(np.mean(all_scores)),
                'max_similarity': float(np.max(all_scores)),
                'min_similarity': float(np.min(all_scores)),
                'std_similarity': float(np.std(all_scores)),
                'cumulative_weighted_score': cumulative_score,
                'total_resume_sections': len(self.resume_metadata),
                'total_jd_sections': len(self.jd_metadata)
            }

        return results, similarity_matrix

    def export_results_to_json(self, results: Dict[str, Any], output_path: str):
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"Results exported to: {output_path}")

    def debug_section_names(self):
        """Helper method to debug section names and weights"""
        print("\n=== DEBUG: Resume Section Names ===")
        weights_mapping = {
            'experience': 3.0, 'work': 3.0, 'employment': 3.0,
            'certifications': 2.0, 'certification': 2.0,
            'skills': 1.5, 'skill': 1.5, 'technical': 1.5,
            'education': 2.0, 'projects': 2.0, 'project': 2.0
        }
        
        for idx, resume_section in enumerate(self.resume_metadata):
            section_name = resume_section.get('section', f'Section_{idx}')
            weight = 1.0
            section_name_lower = section_name.lower()
            for key in weights_mapping:
                if key in section_name_lower:
                    weight = weights_mapping[key]
                    break
            
            print(f"Section {idx}: '{section_name}' -> Weight: {weight}")
        
        print("\n=== DEBUG: JD Section Names ===")
        for idx, jd_section in enumerate(self.jd_metadata):
            section_name = jd_section.get('section', f'JD_Section_{idx}')
            print(f"JD Section {idx}: '{section_name}'")


# ---------------- USAGE ----------------
if __name__ == "__main__":
    matcher = ResumeJDSimilarityMatcher(
        resume_index_path="resume_embeddings.index",
        resume_metadata_path="resume_embeddings_metadata.json",
        jd_index_path="job_description_embeddings.index",
        jd_metadata_path="job_description_embeddings_metadata.json"  # Fixed: use metadata file
    )

    # Debug section names and weights
    matcher.debug_section_names()

    results, similarity_matrix = matcher.find_best_matches_vectorized(top_k=3)
    matcher.export_results_to_json(results, "similarity_analysis_results.json")
    np.save("resume_jd_similarity_matrix.npy", similarity_matrix)

    # Update database with calculated scores
    db_success = matcher.update_database(results)

    summary = results.get('overall_summary', {})
    print("\nOverall Analysis Summary:")
    print(f"Mean similarity score: {summary.get('mean_similarity', 0):.4f}")
    print(f"Max similarity score: {summary.get('max_similarity', 0):.4f}")
    print(f"Min similarity score: {summary.get('min_similarity', 0):.4f}")
    print(f"Std deviation: {summary.get('std_similarity', 0):.4f}")
    print(f"Cumulative weighted similarity score: {summary.get('cumulative_weighted_score', 0):.4f}")

    # Print section-wise results with weights
    print("\n=== Section-wise Results ===")
    for section_name, section_data in results['section_matches'].items():
        weight = section_data['weight']
        score = section_data['overall_similarity_score']
        print(f"{section_name}: Score={score:.4f}, Weight={weight}, Weighted={score*weight:.4f}")

    if db_success:
        print("\n=== SUCCESS ===")
        print("Similarity analysis completed and database updated successfully!")
    else:
        print("\n=== WARNING ===")
        print("Similarity analysis completed but database update failed!")