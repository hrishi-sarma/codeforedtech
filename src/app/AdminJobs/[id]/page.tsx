'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { 
  getCurrentUser, 
  checkIfUserIsAdmin, 
  getJobById, 
  supabase,
  downloadResume 
} from '@/lib/supabaseClient'

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

interface JobApplication {
  id: number
  user_id: string
  applied_at: string
  status: string
  hireability_percentage: number
  experience: number
  skills: number
  education: number
  total_score: number
  remarks: string | null
  resume_url?: string | null
  user_email?: string | null
}

const AdminJobDetails: React.FC = () => {
  const router = useRouter()
  const params = useParams()
  const jobId = params?.id ? parseInt(params.id as string) : null

  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [downloadingResume, setDownloadingResume] = useState<string | null>(null)

  useEffect(() => {
    const initializeAdminJobPage = async () => {
      if (!jobId) {
        router.push('/AdminDash')
        return
      }

      try {
        // Check authentication and admin status
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push('/auth')
          return
        }

        const isAdmin = await checkIfUserIsAdmin()
        if (!isAdmin) {
          router.push('/Home')
          return
        }

        setUser(currentUser)
        await loadJobDetails()
      } catch (error) {
        console.error('Error initializing admin job page:', error)
        router.push('/AdminDash')
      } finally {
        setLoading(false)
      }
    }

    initializeAdminJobPage()
  }, [jobId, router])

  const loadJobDetails = async () => {
    if (!jobId) return

    try {
      // Fetch job details
      const jobData = await getJobById(jobId)
      setJob(jobData)

      // Fetch basic applications first
      const { data: basicApplications, error: basicError } = await supabase
        .from('job_applications')
        .select('*')
        .eq('job_id', jobId)
        .order('applied_at', { ascending: false })

      if (basicError) {
        console.error('Error with basic applications query:', basicError)
        setApplications([])
        return
      }

      if (!basicApplications || basicApplications.length === 0) {
        setApplications([])
        return
      }

      // Get unique user IDs
      const userIds = [...new Set(basicApplications.map(app => app.user_id))]
      
      // Fetch user profiles for resume URLs
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, resume_url')
        .in('id', userIds)

      const profileMap = new Map<string, string | null>()
      userProfiles?.forEach(profile => {
        profileMap.set(profile.id, profile.resume_url)
      })

      // Since we can't easily get user emails from auth.users in the client,
      // we'll use user IDs as identifiers for now
      const enhancedApplications: JobApplication[] = basicApplications.map((app, index) => ({
        ...app,
        resume_url: profileMap.get(app.user_id) || null,
        user_email: `user_${app.user_id.substring(0, 8)}` // Use first 8 chars of user_id as identifier
      }))

      setApplications(enhancedApplications)

    } catch (error) {
      console.error('Error loading job details:', error)
      setApplications([])
    }
  }

  const handleDownloadResume = async (userId: string, userEmail: string) => {
    try {
      setDownloadingResume(userId)
      console.log('Attempting to download resume for user:', userId)
      
      // Try the main download function
      await downloadResume(userId)
      console.log('Download successful')
      
    } catch (error) {
      console.error('Error downloading resume:', error)
      
      // Try alternative approach - direct URL opening
      try {
        console.log('Trying alternative download approach...')
        
        // Get the resume URL directly
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('resume_url')
          .eq('id', userId)
          .maybeSingle()
          
        if (profile?.resume_url) {
          // Try opening the URL directly in a new tab
          window.open(profile.resume_url, '_blank')
        } else {
          throw new Error('No resume URL found')
        }
        
      } catch (altError) {
        console.error('Alternative download also failed:', altError)
        alert(`Failed to download resume for ${userEmail || userId}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
    } finally {
      setDownloadingResume(null)
    }
  }

  const formatCriteria = (criteria: string) => {
    return criteria.split(/[.!?]/).filter(c => c.trim()).map(c => c.trim())
  }

  const getHighestScore = () => {
    if (applications.length === 0) return '-'
    const highest = Math.max(...applications.map(app => app.total_score || 0))
    return highest > 0 ? highest.toFixed(1) : '-'
  }

  const getShortlistedCount = () => {
    // Consider applications with total_score > 70 as shortlisted
    return applications.filter(app => (app.total_score || 0) > 70).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-bold">Loading job details...</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl text-red-600">Job not found</div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-white p-6"
      style={{ fontFamily: "'Comic Neue', cursive" }}
    >
      

      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/Admindash')}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto bg-white rounded-3xl p-8 border-4 border-black shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Side - Job Details */}
          <div className="bg-white border-2 border-black rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6 text-center">Job Details</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold mb-2">{job.company_name}</h3>
                <p className="text-gray-600 mb-2">{job.title}</p>
                {job.salary_range && (
                  <p className="text-green-600 font-semibold">{job.salary_range}</p>
                )}
              </div>

              <div>
                <h4 className="font-bold mb-2">Description</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {job.detailed_description}
                </p>
              </div>

              <div>
                <h4 className="font-bold mb-2">Criteria</h4>
                <div className="text-gray-700 text-sm">
                  {formatCriteria(job.criteria).map((criterion, index) => (
                    <div key={index} className="mb-1">
                      • {criterion}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-gray-500">
                  <p>Status: <span className={`font-semibold ${job.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>{job.status}</span></p>
                  <p>Created: {new Date(job.created_at).toLocaleDateString()}</p>
                  <p>Applications: {applications.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Admin Analytics */}
          <div className="lg:col-span-2 bg-black text-white rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6 text-center">Admin Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* All Applicants */}
              <div className="bg-white text-black rounded-xl p-4">
                <h3 className="font-bold mb-4 text-lg">All Applicants</h3>
                
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {applications.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>No applications yet</p>
                    </div>
                  ) : (
                    applications.map((application, index) => (
                      <div 
                        key={application.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {application.user_email?.split('@')[0] || `Applicant ${index + 1}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            Applied: {new Date(application.applied_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-blue-600">
                            Status: {application.status}
                          </div>
                          {application.total_score > 0 && (
                            <div className="text-xs text-green-600">
                              Score: {application.total_score.toFixed(1)}%
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleDownloadResume(application.user_id, application.user_email || '')}
                          disabled={downloadingResume === application.user_id || !application.resume_url}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            !application.resume_url
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : downloadingResume === application.user_id
                              ? 'bg-gray-400 text-white cursor-wait'
                              : 'bg-black text-white hover:bg-gray-700'
                          }`}
                        >
                          {downloadingResume === application.user_id 
                            ? 'Loading...' 
                            : !application.resume_url 
                            ? 'No Resume' 
                            : 'View'
                          }
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Analytics Summary */}
              <div className="bg-white text-black rounded-xl p-4">
                <div className="space-y-6">
                  
                  {/* Statistics */}
                  <div>
                    <div className="text-lg font-bold mb-3">Total Applied: {applications.length}</div>
                    <div className="text-sm text-gray-600 mb-1">Shortlisted: {getShortlistedCount()}</div>
                    <div className="text-sm text-gray-600 mb-4">Highest Score: {getHighestScore()}</div>
                  </div>

                  {/* Score Distribution */}
                  <div className="bg-gray-100 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Score Distribution</h4>
                    <div className="space-y-2">
                      {['90-100', '80-89', '70-79', '60-69', 'Below 60'].map(range => {
                        let count = 0
                        const [min, max] = range === 'Below 60' 
                          ? [0, 59] 
                          : range.split('-').map(n => parseInt(n))
                        
                        count = applications.filter(app => {
                          const score = app.total_score || 0
                          return range === 'Below 60' 
                            ? score < 60 
                            : score >= min && score <= max
                        }).length

                        return (
                          <div key={range} className="flex justify-between text-sm">
                            <span>{range}%:</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Application Status Breakdown */}
                  <div className="space-y-2">
                    <h4 className="font-semibold">Application Status:</h4>
                    {['pending', 'accepted', 'rejected'].map(status => {
                      const count = applications.filter(app => app.status === status).length
                      return (
                        <div key={status} className="flex justify-between text-sm">
                          <span className="capitalize">{status}:</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Recent Applications */}
                  <div>
                    <h4 className="font-semibold mb-2">Recent Applications:</h4>
                    <div className="text-xs space-y-1">
                      {applications.slice(0, 3).map(app => (
                        <div key={app.id} className="text-gray-600">
                          {new Date(app.applied_at).toLocaleDateString()} - {app.user_email?.split('@')[0] || 'Anonymous'}
                        </div>
                      ))}
                      {applications.length === 0 && (
                        <div className="text-gray-500">No applications yet</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminJobDetails