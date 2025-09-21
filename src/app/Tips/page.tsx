'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getUserTipsForJob, getCurrentUser, getJobById } from '@/lib/supabaseClient'

interface Job {
  id: number
  title: string
  company_name: string
}

const TipsPage: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId') ? parseInt(searchParams.get('jobId')!) : null
  
  const [tips, setTips] = useState<string[]>([])
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTipsAndJobInfo = async () => {
      try {
        setLoading(true)
        const user = await getCurrentUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        // If jobId is provided, get tips for specific job and job details
        if (jobId) {
          console.log('Fetching tips for specific job ID:', jobId)
          
          // Get job details
          try {
            const jobData = await getJobById(jobId)
            setJob(jobData)
            console.log('Job data fetched:', jobData)
          } catch (jobError) {
            console.error('Error fetching job details:', jobError)
            // Continue even if job details fail
          }
          
          // Get tips for this specific job
          const jobSpecificTips = await getUserTipsForJob(jobId)
          setTips(jobSpecificTips)
          console.log('Job-specific tips:', jobSpecificTips)
        } else {
          // Fallback to all tips if no jobId provided
          console.log('No job ID provided, fetching all tips')
          const allTips = await getUserTipsForJob()
          setTips(allTips)
        }
      } catch (err) {
        console.error('Error fetching tips:', err)
        setError('Failed to load improvement tips')
      } finally {
        setLoading(false)
      }
    }

    fetchTipsAndJobInfo()
  }, [router, jobId])

  const handleGoHome = () => {
    router.push('/Home')
  }

  const handleGoBack = () => {
    if (jobId) {
      router.push(`/Jobs/${jobId}`)
    } else {
      router.back()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-bold">Loading tips...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white mt-50 py-8 px-4" style={{ fontFamily: "'Comic Neue', cursive" }}>
      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        {/* Browser-like container */}
        <div className="bg-white rounded-2xl border-4 border-black shadow-lg overflow-hidden" style={{ minHeight: '600px' }}>
          {/* Browser header */}
          <div className="bg-gray-100 border-b-2 border-black p-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full"></div>
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            </div>
          </div>

          {/* Content */}
          <div className="p-12">
            <div className="text-center">
              {/* Dynamic title based on whether it's job-specific or general */}
              <h1 className="text-4xl font-bold mb-4">
                {jobId && job ? 'Improvement Tips' : 'Ways to improve resume'}
              </h1>
              
              {/* Show job context if available */}
              {jobId && job && (
                <div className="mb-8 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <p className="text-lg text-blue-800">
                    Tips for your application to <strong>{job.company_name}</strong> - <strong>{job.title}</strong>
                  </p>
                </div>
              )}
              
              <div className="space-y-8">
                {error ? (
                  <div className="text-red-600 text-lg">
                    {error}
                  </div>
                ) : tips.length > 0 ? (
                  tips.map((tip, index) => (
                    <div key={index} className="text-left">
                      <p className="text-lg text-gray-600 leading-relaxed">
                        {tip}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-600">
                    <p className="text-xl mb-4">
                      {jobId ? 'No specific tips available for this application.' : 'No specific tips available yet.'}
                    </p>
                    <p className="text-lg">
                      {jobId 
                        ? 'The system may not have generated feedback for this specific application yet.'
                        : 'Apply to more jobs to receive personalized feedback and improvement suggestions.'
                      }
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-16 flex gap-4 justify-center">
                <button
                  onClick={handleGoBack}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg border-2 border-gray-400 hover:bg-gray-300 transition-colors font-medium text-lg"
                >
                  {jobId ? 'Back to Job' : 'Go Back'}
                </button>
                <button
                  onClick={handleGoHome}
                  className="px-8 py-3 bg-black text-white rounded-lg border-2 border-black hover:bg-white hover:text-black transition-colors font-medium text-lg"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TipsPage