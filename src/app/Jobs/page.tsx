'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRecommendedJobs, getAppliedJobs, applyToJob, getCurrentUser } from '@/lib/supabaseClient'

// Define types for our job data
interface Job {
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

interface AppliedJob extends Job {
  job_applications: {
    applied_at: string
    status: string
    hireability_percentage?: number
    experience?: number
    skills?: number
    education?: number
    total_score?: number
    remarks?: string | null
  }[]
}

const JobsDashboard: React.FC = () => {
  const router = useRouter()
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([])
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<number | null>(null)
  const [user, setUser] = useState<any>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Fetch jobs on component mount
  useEffect(() => {
    const fetchJobsAndUser = async () => {
      try {
        setLoading(true)
        console.log('Starting to fetch jobs and user...')
        
        // Get current user
        const currentUser = await getCurrentUser()
        setUser(currentUser)
        console.log('Current user:', currentUser ? 'Authenticated' : 'Not authenticated')
        
        // Fetch jobs
        const [recommended, applied] = await Promise.all([
          getRecommendedJobs(),
          getAppliedJobs()
        ])
        
        console.log('Recommended jobs:', recommended?.length || 0)
        console.log('Applied jobs:', applied?.length || 0)
        
        setRecommendedJobs(recommended || [])
        setAppliedJobs(applied || [])
      } catch (error) {
        console.error('Error fetching jobs:', error)
        setMessage({
          type: 'error',
          text: 'Failed to load jobs. Please refresh the page.'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchJobsAndUser()
  }, [])

  // Handle job application
  const handleApply = async (jobId: number) => {
    if (!user) {
      setMessage({
        type: 'error',
        text: 'Please log in to apply for jobs'
      })
      // You might want to redirect to login page here
      // router.push('/login')
      return
    }

    try {
      setApplying(jobId)
      setMessage(null)
      
      await applyToJob(jobId)
      
      // Refresh the data after successful application
      const [recommended, applied] = await Promise.all([
        getRecommendedJobs(),
        getAppliedJobs()
      ])
      
      setRecommendedJobs(recommended || [])
      setAppliedJobs(applied || [])
      
      setMessage({
        type: 'success',
        text: 'Application submitted successfully!'
      })
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
      
    } catch (error) {
      console.error('Error applying to job:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to apply to job'
      })
      
      // Clear error message after 5 seconds
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setApplying(null)
    }
  }

  // Truncate description for card display
  const truncateDescription = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    return text.substr(0, maxLength) + '...'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-bold">Loading jobs...</div>
      </div>
    )
  }

  return (
    <div
      className="flex max-h-[89vh] flex-col md:flex-row gap-6 px-6 pt-24 pb-6 rounded-2xl"
      style={{ fontFamily: "'Comic Neue', cursive" }}
    >
      {/* Success/Error Message */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          message.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 
          'bg-red-100 border border-red-400 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            <span>{message.type === 'success' ? '✅' : '❌'}</span>
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-2 text-sm hover:font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* User Status */}
      {!loading && (
        <div className="fixed top-4 left-4 z-40 bg-white px-3 py-1 rounded-full text-sm">
         
        </div>
      )}
      {/* Recommended Jobs */}
      <div className="text-black flex-1 self-start max-h-[80vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 rounded-md">
        <h2 className="text-3xl text-white font-bold mb-6">Recommended Jobs</h2>
        {recommendedJobs.length === 0 ? (
          <p className="text-gray-600 text-lg">No recommended jobs available at the moment.</p>
        ) : (
          <div className="space-y-4">
            {recommendedJobs.map((job) => (
              <div
                key={job.id}
                className="flex justify-between items-start bg-white border-2 border-black rounded-xl p-4 shadow-md"
              >
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-semibold">{job.company_name}</h3>
                    <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {job.applications_count} applied
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-1">{job.title}</p>
                  {job.salary_range && (
                    <p className="text-sm font-medium text-green-600 mb-2">{job.salary_range}</p>
                  )}
                  <p className="text-gray-600 text-sm mb-2">
                    {truncateDescription(job.detailed_description)}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">Status: {job.status}</p>
                </div>
                <div className="flex flex-col gap-2">
                  
                  <button
                    onClick={() => router.push(`/Jobs/${job.id}`)}
                    className="px-4 py-2 rounded-lg bg-white text-black hover:bg-black hover:text-white border-2 border-black transition-colors whitespace-nowrap"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Previously Applied */}
      <div className="w-full md:w-1/3 bg-black text-white rounded-2xl p-4 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Previously Applied</h2>
        {appliedJobs.length === 0 ? (
          <p className="text-gray-300">No job applications yet.</p>
        ) : (
          <div className="space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 rounded-md">
            {appliedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white text-black border-2 border-black rounded-lg p-3"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{job.company_name}</h4>
                    <p className="text-xs text-gray-600 mb-1">{job.title}</p>
                    {job.salary_range && (
                      <p className="text-xs text-green-600 mb-1">{job.salary_range}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Applied: {new Date(job.job_applications[0]?.applied_at || '').toLocaleDateString()}
                    </p>
                    <p className="text-xs text-blue-600 capitalize">
                      Status: {job.job_applications[0]?.status || 'pending'}
                    </p>
                    {/* Show application scores if available */}
                    {job.job_applications[0]?.total_score && (
                      <div className="mt-1 text-xs">
                        <p className="text-purple-600">
                          Score: {job.job_applications[0].total_score}/100
                        </p>
                        {job.job_applications[0].hireability_percentage && (
                          <p className="text-orange-600">
                            Match: {job.job_applications[0].hireability_percentage}%
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/Jobs/${job.id}`)}
                  className="w-full px-3 py-1 rounded-md bg-black text-white hover:bg-white hover:text-black border-2 border-black transition-colors text-sm"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default JobsDashboard