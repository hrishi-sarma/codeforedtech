export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      // -------------------------
      // Jobs table
      // -------------------------
      jobs: {
        Row: {
          id: number
          title: string
          detailed_description: string
          criteria: string
          status: string
          applications_count: number
          company_name: string
          salary_range: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          title: string
          detailed_description: string
          criteria: string
          status?: string
          applications_count?: number
          company_name: string
          salary_range?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          title?: string
          detailed_description?: string
          criteria?: string
          status?: string
          applications_count?: number
          company_name?: string
          salary_range?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      // -------------------------
      // Job Applications table (UPDATED - with acceptance field)
      // -------------------------
      job_applications: {
        Row: {
          id: number
          user_id: string
          job_id: number
          applied_at: string
          status: string
          hireability_percentage: number
          experience: number
          skills: number
          education: number
          total_score: number
          remarks: string | null
          acceptance: 'accepted' | 'rejected' | 'pending'
        }
        Insert: {
          id?: number
          user_id: string
          job_id: number
          applied_at?: string
          status?: string
          hireability_percentage?: number
          experience?: number
          skills?: number
          education?: number
          total_score?: number
          remarks?: string | null
          acceptance?: 'accepted' | 'rejected' | 'pending'
        }
        Update: {
          id?: number
          user_id?: string
          job_id?: number
          applied_at?: string
          status?: string
          hireability_percentage?: number
          experience?: number
          skills?: number
          education?: number
          total_score?: number
          remarks?: string | null
          acceptance?: 'accepted' | 'rejected' | 'pending'
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }

      // -------------------------
      // Job PDFs table
      // -------------------------
      job_pdfs: {
        Row: {
          id: number
          job_id: number
          file_name: string
          job_pdf_url: string
          file_size: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          job_id: number
          file_name: string
          job_pdf_url: string
          file_size?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          job_id?: number
          file_name?: string
          job_pdf_url?: string
          file_size?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_pdfs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          }
        ]
      }

      // -------------------------
      // User Profiles table (UPDATED - matches your actual structure)
      // -------------------------
      user_profiles: {
        Row: {
          id: string
          resume_url: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          resume_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          resume_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      increment_job_applications: {
        Args: {
          job_id: number
        }
        Returns: undefined
      }
      calculate_hireability: {
        Args: {
          user_id_param: string
          job_id_param: number
        }
        Returns: number
      }
      create_random_user_profile: {
        Args: {
          user_id_param: string
        }
        Returns: undefined
      }
      handle_resume_upload: {
        Args: {
          user_id_param: string
          new_resume_url: string
        }
        Returns: undefined
      }
      is_admin: {
        Args: {}
        Returns: boolean
      }
      make_user_admin: {
        Args: {
          user_email: string
        }
        Returns: string
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}