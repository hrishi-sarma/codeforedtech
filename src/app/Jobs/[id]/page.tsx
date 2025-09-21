'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getJobById, applyToJob, getCurrentUser, getApplicationDetails } from '@/lib/supabaseClient'

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

interface ApplicationDetails {
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

// API configuration for parsePDF.py server (port 8001)
const PDF_PARSER_ENDPOINTS = [
  'http://localhost:8001',
  'http://127.0.0.1:8001'
]

const JobDetailsPage: React.FC = () => {
  const router = useRouter()
  const params = useParams()
  const jobId = params?.id ? parseInt(params.id as string) : null

  const [job, setJob] = useState<Job | null>(null)
  const [applicationDetails, setApplicationDetails] = useState<ApplicationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Enhanced function to test parsePDF server connectivity with better error handling
  const testParsePDFConnection = async () => {
    console.log('Testing parsePDF server connectivity...')
    
    for (const endpoint of PDF_PARSER_ENDPOINTS) {
      try {
        console.log(`Testing connection to parsePDF: ${endpoint}`)
        
        // Create an AbortController for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        // Test with the health endpoint first
        const testResponse = await fetch(`${endpoint}/health`, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (testResponse.ok) {
          const healthData = await testResponse.json()
          console.log(`Successfully connected to parsePDF server at: ${endpoint}`, healthData)
          
          // Test the main endpoint with OPTIONS request
          try {
            const optionsController = new AbortController()
            const optionsTimeoutId = setTimeout(() => optionsController.abort(), 5000)
            
            const optionsResponse = await fetch(`${endpoint}/process_pdfs`, {
              method: 'OPTIONS',
              mode: 'cors',
              signal: optionsController.signal
            })
            
            clearTimeout(optionsTimeoutId)
            
            if (optionsResponse.ok || optionsResponse.status === 405) {
              console.log(`/process_pdfs endpoint available at: ${endpoint}`)
              return endpoint
            } else {
              console.log(`/process_pdfs endpoint may not be available at: ${endpoint}`)
            }
          } catch (optionsError) {
            console.log(`Could not verify /process_pdfs endpoint at ${endpoint}:`, optionsError)
          }
          
          // Still return this endpoint as the server is responding
          return endpoint
        } else {
          console.log(`parsePDF ${endpoint} returned ${testResponse.status}: ${testResponse.statusText}`)
        }
      } catch (error) {
        console.log(`Failed to connect to parsePDF ${endpoint}:`, error)
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.log(`   Timeout: Server took too long to respond`)
          } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.log(`   Network error: Could be CORS, server not running, or connection refused`)
          }
        }
      }
    }
    return null
  }

  // Enhanced function to call the parsePDF.py endpoint
  const processPDFsWithAPI = async (userId: string, jobId: number) => {
    console.log('=== STARTING PDF PROCESSING ===')
    console.log(`Processing PDFs for user ${userId} and job ${jobId}`)
  
    // First test connectivity
    const workingEndpoint = await testParsePDFConnection()
    if (!workingEndpoint) {
      throw new Error('Cannot connect to parsePDF server on any endpoint. Please ensure:\n\n1. parsePDF server is running: python parsePDF.py\n2. Server is accessible on port 8001\n3. No firewall is blocking the connection\n4. Check terminal for any parsePDF startup errors\n5. Try running: lsof -i :8001 to check if port is in use')
    }

    console.log(`Using working parsePDF endpoint: ${workingEndpoint}`)

    const requestBody = {
      user_id: userId,
      job_id: jobId
    }

    try {
      console.log(`Sending POST request to: ${workingEndpoint}/process_pdfs`)
      console.log('Request body:', requestBody)
      
      // Create an AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minutes timeout
      
      const response = await fetch(`${workingEndpoint}/process_pdfs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        mode: 'cors',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log(`parsePDF Response status: ${response.status}`)

      if (!response.ok) {
        let errorText = 'Unknown error'
        try {
          const errorData = await response.json()
          errorText = errorData.detail || errorData.message || `HTTP ${response.status}`
          console.error('parsePDF Error Response JSON:', errorData)
        } catch {
          errorText = await response.text() || `HTTP ${response.status}`
          console.error('parsePDF Error Response Text:', errorText)
        }
        
        throw new Error(`parsePDF server returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log(`parsePDF processing successful:`, result)
      
      if (result.status !== 'success') {
        throw new Error(result.message || 'parsePDF processing failed with unknown error')
      }

      return result

    } catch (error) {
      console.error('Error in parsePDF processing:', error)
      
      // Provide more specific error messages
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request Timeout: PDF processing took longer than 2 minutes.\n\nThis might be due to:\n• Large PDF files\n• AI model processing delay\n• Server performance issues\n\nTry again or check server logs.')
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network Error: Cannot reach parsePDF server.\n\nTroubleshooting:\n• Is the parsePDF server running? Run: python parsePDF.py\n• Check if port 8001 is available\n• Try restarting the parsePDF server\n• Check for CORS issues')
      } else if (error instanceof Error) {
        throw error
      } else {
        throw new Error('Unknown error occurred during PDF processing')
      }
    }
  }

  // Debug function to refresh application details
  const refreshApplicationDetails = async () => {
    if (!user || !jobId) return
  
    console.log('=== REFRESHING APPLICATION DETAILS ===')
    console.log('User ID:', user.id)
    console.log('Job ID:', jobId)
  
    try {
      // Add timeout for this operation
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      const appDetails = await getApplicationDetails(user.id, jobId)
      clearTimeout(timeoutId)
      
      console.log('Fresh application details:', appDetails)

      if (appDetails) {
        setApplicationDetails(appDetails)
        setHasApplied(true)
        console.log('Application details updated:', {
          acceptance: appDetails.acceptance,
          status: appDetails.status,
          remarks: appDetails.remarks,
          total_score: appDetails.total_score
        })
      } else {
        console.log('No application found')
        // Don't reset if we know the user just applied
        if (!applying) {
          setApplicationDetails(null)
          setHasApplied(false)
        }
      }
    } catch (error) {
      console.error('Error refreshing application details:', error)
      // Don't throw error here as it's not critical
    }
  }

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) {
        router.push('/jobs')
        return
      }

      try {
        setLoading(true)

        // Get current user
        const currentUser = await getCurrentUser()
        setUser(currentUser)

        // Fetch job details
        const jobData = await getJobById(jobId)
        setJob(jobData)

        if (currentUser) {
          // Get application details if user has applied
          const appDetails = await getApplicationDetails(currentUser.id, jobId)
          console.log('Initial application details:', appDetails)
          
          if (appDetails) {
            setApplicationDetails(appDetails)
            setHasApplied(true)
          }
        }
      } catch (error) {
        console.error('Error fetching job details:', error)
        setMessage({
          type: 'error',
          text: 'Failed to load job details'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchJobDetails()
  }, [jobId, router])

  // Original handleApply function - database submission only
  const handleApply = async () => {
    if (!user || !jobId) {
      setMessage({
        type: 'error',
        text: 'Please log in to apply for jobs'
      })
      return
    }

    // Check if job is active before allowing application
    if (job?.status !== 'active') {
      setMessage({
        type: 'error',
        text: 'This job is no longer accepting applications'
      })
      return
    }

    try {
      setApplying(true)
      setMessage(null)

      console.log('=== STARTING APPLICATION SUBMISSION ===')
      console.log('User ID:', user.id)
      console.log('Job ID:', jobId)

      setMessage({
        type: 'success',
        text: 'Submitting your application...'
      })

      console.log('Submitting application to database...')
      await applyToJob(jobId)
      console.log('Application submitted successfully')

      // Update UI immediately
      setHasApplied(true)
      
      // Wait a moment then refresh application details
      await new Promise(resolve => setTimeout(resolve, 1000))
      await refreshApplicationDetails()

      setMessage({
        type: 'success',
        text: 'Application submitted successfully! Click "Process Resume" to calculate your score.'
      })

      // Clear message after delay
      setTimeout(() => setMessage(null), 5000)

    } catch (error) {
      console.error('=== APPLICATION ERROR ===', error)

      let errorMessage = 'Failed to apply to job'

      if (error instanceof Error) {
        if (error.message.includes('already applied')) {
          errorMessage = 'You have already applied to this job'
          setHasApplied(true)
          await refreshApplicationDetails()
        } else if (error.message.includes('upload your resume')) {
          errorMessage = 'Please upload your resume before applying. Visit your profile to upload one.'
        } else {
          errorMessage = error.message
        }
      }

      setMessage({
        type: 'error',
        text: errorMessage
      })

      setTimeout(() => setMessage(null), 10000)
    } finally {
      setApplying(false)
      console.log('=== APPLICATION SUBMISSION COMPLETED ===')
    }
  }

  // NEW: Separate function to handle PDF processing and scoring
  const handleProcessResume = async () => {
    if (!user || !jobId) {
      setMessage({
        type: 'error',
        text: 'Please log in to process resume'
      })
      return
    }

    if (!hasApplied) {
      setMessage({
        type: 'error',
        text: 'Please apply to the job first before processing your resume'
      })
      return
    }

    try {
      setApplying(true)
      setMessage(null)

      console.log('=== STARTING RESUME PROCESSING ===')
      console.log('User ID:', user.id)
      console.log('Job ID:', jobId)

      setMessage({
        type: 'success',
        text: 'Step 1/3: Testing connection to resume processing server...'
      })

      // Test server connectivity
      const workingEndpoint = await testParsePDFConnection()
      if (!workingEndpoint) {
        throw new Error('Resume processing server is not available. Please ensure the Python server is running on port 8001.')
      }

      setMessage({
        type: 'success',
        text: 'Step 2/3: Processing your resume and calculating scores...'
      })

      // Process PDFs for scoring
      console.log('Starting PDF processing...')
      const pdfResult = await processPDFsWithAPI(user.id, jobId)
      console.log('PDF processing completed successfully:', pdfResult)

      setMessage({
        type: 'success',
        text: 'Step 3/3: Updating your application with calculated scores...'
      })

      // Wait for database to update with scores
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Refresh details to get the scoring results
      await refreshApplicationDetails()

      setMessage({
        type: 'success',
        text: 'Resume processed successfully! Your application score has been calculated.'
      })

      // Clear message after delay
      setTimeout(() => setMessage(null), 8000)

    } catch (error) {
      console.error('=== RESUME PROCESSING ERROR ===', error)

      let errorMessage = 'Failed to process resume'

      if (error instanceof Error) {
        if (error.message.includes('timed out') || error.message.includes('Timeout')) {
          errorMessage = 'Resume processing timed out. This may be due to large files or server load. Please try again.'
        } else if (error.message.includes('connect') || error.message.includes('Network') || error.message.includes('not available')) {
          errorMessage = 'Cannot connect to resume processing server. Please ensure the Python server is running on port 8001.'
        } else if (error.message.includes('Resume not found') || error.message.includes('upload your resume')) {
          errorMessage = 'Please make sure you have uploaded your resume in your profile.'
        } else {
          errorMessage = error.message
        }
      }

      setMessage({
        type: 'error',
        text: errorMessage
      })

      setTimeout(() => setMessage(null), 12000)
    } finally {
      setApplying(false)
      console.log('=== RESUME PROCESSING COMPLETED ===')
    }
  }

  const handleNextSteps = () => {
    console.log('=== NEXT STEPS CLICKED ===')
    console.log('Application acceptance:', applicationDetails?.acceptance)
  
    if (applicationDetails?.acceptance === 'rejected') {
      console.log('Redirecting to tips page with job ID...')
      // Pass the job ID as a URL parameter
      router.push(`/Tips?jobId=${jobId}`)
    } else if (applicationDetails?.acceptance === 'accepted') {
      console.log('Showing accepted message...')
      setMessage({
        type: 'success',
        text: 'Congratulations! You have been accepted. Please wait for further instructions.'
      })
      setTimeout(() => setMessage(null), 5000)
    } else {
      console.log('Unexpected acceptance status:', applicationDetails?.acceptance)
    }
  }

  const formatCriteria = (criteria: string) => {
    // Split by common delimiters and format
    return criteria.split(/[.!?]/).filter(c => c.trim()).map(c => c.trim())
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBackground = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getAcceptanceStatus = () => {
    console.log('=== GETTING ACCEPTANCE STATUS ===')
    console.log('Application details:', applicationDetails)
    console.log('Acceptance value:', applicationDetails?.acceptance)
    
    if (!applicationDetails?.acceptance) {
      console.log('No acceptance status found')
      return null
    }
    
    switch (applicationDetails.acceptance) {
      case 'accepted':
        console.log('Status: ACCEPTED')
        return {
          text: 'ACCEPTED',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-300'
        }
      case 'rejected':
        console.log('Status: REJECTED')
        return {
          text: 'REJECTED',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-300'
        }
      case 'pending':
        console.log('Status: PENDING')
        return {
          text: 'UNDER REVIEW',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-300'
        }
      default:
        console.log('Unknown status:', applicationDetails.acceptance)
        return null
    }
  }

  const isJobActive = job?.status === 'active'
  const isJobInactive = job?.status === 'inactive'
  const acceptanceStatus = getAcceptanceStatus()
  const showNextStepsButton = applicationDetails?.acceptance === 'accepted' || applicationDetails?.acceptance === 'rejected'

  console.log('=== RENDER DEBUG ===')
  console.log('Has applied:', hasApplied)
  console.log('Application details:', applicationDetails)
  console.log('Acceptance status object:', acceptanceStatus)
  console.log('Show next steps button:', showNextStepsButton)

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
    <div className="min-h-screen bg-white py-8 px-4" style={{ fontFamily: "'Comic Neue', cursive" }}>
      
      {/* Success/Error Message */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md ${
          message.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 
          'bg-red-100 border border-red-400 text-red-700'
        }`}>
          <div className="flex items-start gap-2">
            <span className="whitespace-pre-line">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-2 text-lg hover:font-bold flex-shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Inactive Job Banner */}
      {isJobInactive && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="font-bold">This job is no longer active</span>
              <span>- Applications are not being accepted</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={() => router.push('/Jobs')} className="hover:text-black">Jobs</button>
            <span>/</span>
            <span className="text-black font-medium">{job.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex gap-6">
        {/* Left Side - Job Details */}
        <div className="flex-1 bg-white rounded-2xl border-2 border-black p-8 shadow-lg">
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2">{job.company_name}</h1>
            <p className="text-xl text-gray-700 mb-1">{job.title}</p>
            {job.salary_range && (
              <p className="text-lg font-semibold text-green-600">{job.salary_range}</p>
            )}
          </div>

          {/* Detailed Description */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Detailed Description</h2>
            <div className="prose prose-lg">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {job.detailed_description}
              </p>
            </div>
          </div>

          {/* Criteria */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Criteria</h2>
            <div className="bg-gray-50 rounded-lg p-6">
              {formatCriteria(job.criteria).map((criterion, index) => (
                <div key={index} className="flex items-start gap-2 mb-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <p className="text-gray-700">{criterion}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Status</h2>
            <div className="flex items-center gap-4">
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                isJobActive ? 'bg-green-100 text-green-800' : 
                isJobInactive ? 'bg-red-100 text-red-800' : 
                'bg-yellow-100 text-yellow-800'
              }`}>
                {job.status.toUpperCase()}
              </span>
              <span className="text-gray-600">
                {job.applications_count} {job.applications_count === 1 ? 'person has' : 'people have'} applied
              </span>
            </div>
          </div>

          {/* Apply and Process Buttons */}
          <div className="flex justify-end gap-4">
            {!user ? (
              <button
                disabled
                className="px-8 py-3 rounded-lg border-2 border-gray-300 bg-gray-300 text-gray-500 cursor-not-allowed font-medium text-lg"
              >
                Login to Apply
              </button>
            ) : !isJobActive ? (
              <button
                disabled
                className="px-8 py-3 rounded-lg border-2 border-red-300 bg-red-300 text-red-700 cursor-not-allowed font-medium text-lg"
              >
                Position No Longer Available
              </button>
            ) : (
              <div className="flex gap-3 items-center">
                {/* Apply Button */}
                <button
                  onClick={handleApply}
                  disabled={applying || hasApplied}
                  className={`px-6 py-3 rounded-lg border-2 font-medium text-base transition-colors ${
                    hasApplied
                      ? 'bg-green-100 text-green-800 border-green-300 cursor-default'
                      : applying
                      ? 'bg-gray-400 text-white cursor-wait border-gray-400'
                      : 'bg-black text-white hover:bg-white hover:text-black border-black'
                  }`}
                >
                  {hasApplied ? 'Applied ✓' : applying ? 'Applying...' : 'Apply Now'}
                </button>

                {/* Process Resume Button - shows immediately after applying */}
                <button
                  onClick={handleProcessResume}
                  disabled={applying || !hasApplied}
                  className={`px-6 py-3 rounded-lg border-2 font-medium text-base transition-colors ${
                    !hasApplied
                      ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-50'
                      : applying
                      ? 'bg-gray-400 text-white cursor-wait border-gray-400'
                      : applicationDetails?.total_score && applicationDetails.total_score > 0
                      ? 'bg-green-600 text-white border-green-600 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700'
                  }`}
                >
                  {!hasApplied 
                    ? 'Process Resume' 
                    : applying 
                    ? 'Processing...' 
                    : applicationDetails?.total_score && applicationDetails.total_score > 0
                    ? 'Processed ✓'
                    : 'Process Resume'}
                </button>

                {/* Next Steps Button - only shows when acceptance status is available */}
                {showNextStepsButton && (
                  <button
                    onClick={handleNextSteps}
                    className="px-6 py-3 rounded-lg border-2 border-purple-600 bg-purple-600 text-white hover:bg-purple-700 hover:border-purple-700 font-medium text-base transition-colors"
                  >
                    Next Steps
                  </button>
                )}
              </div>
            )}
            
            {/* Application Date */}
            {hasApplied && applicationDetails?.applied_at && (
              <div className="flex flex-col justify-center">
                <p className="text-sm text-gray-600">
                  Applied on {new Date(applicationDetails.applied_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - User Stats */}
        <div className="w-80 bg-black text-white rounded-2xl p-6 shadow-lg h-fit">
          <h2 className="text-2xl font-bold mb-6 text-center">Application Status</h2>
          
          {user ? (
            <div className="space-y-6">
              {/* Job Status Alert */}
              {isJobInactive && (
                <div className="bg-red-600 rounded-xl p-4">
                  <h3 className="font-bold text-center mb-2">Job Deactivated</h3>
                  <p className="text-sm text-center">This position is no longer accepting new applications.</p>
                </div>
              )}

              {/* Current Application Details */}
              {hasApplied && applicationDetails ? (
                <div className="space-y-4">
                  {/* Acceptance Status Banner */}
                  {acceptanceStatus && (
                    <div className={`${acceptanceStatus.bgColor} ${acceptanceStatus.textColor} rounded-xl p-4 text-center border-2 ${acceptanceStatus.borderColor}`}>
                      <h3 className="font-bold text-lg mb-2">{acceptanceStatus.text}</h3>
                      {applicationDetails.acceptance === 'accepted' && (
                        <p className="text-sm">Congratulations! You have been selected for this position.</p>
                      )}
                      {applicationDetails.acceptance === 'rejected' && (
                        <p className="text-sm">Thank you for your application. Provided tips to help you improve.</p>
                      )}
                      {applicationDetails.acceptance === 'pending' && (
                        <p className="text-sm">Your application is being reviewed. Will notify you once a decision is made.</p>
                      )}
                    </div>
                  )}

                  <div className="bg-white text-black rounded-xl p-4">
                    <div className="text-center">
                      <h3 className="font-bold text-lg mb-2">Application Submitted!</h3>
                      <p className="text-sm text-gray-600">
                        {isJobInactive 
                          ? "Your application was submitted before this job was deactivated and is still being considered."
                          : "Your application has been received and is being reviewed."
                        }
                      </p>
                    </div>
                  </div>

                  {/* Application Status */}
                  <div className="bg-gray-800 rounded-xl p-4">
                    <h3 className="font-bold mb-3">Application Details</h3>
                    <div className="space-y-2 text-sm">
                      
                      {applicationDetails.applied_at && (
                        <div className="flex justify-between">
                          <span>Applied:</span>
                          <span>{new Date(applicationDetails.applied_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Score Details */}
                    {applicationDetails.total_score && applicationDetails.total_score > 0 ? (
                      <div className="mt-4 border-t border-gray-600 pt-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Overall Score:</span>
                          <span className={`px-2 py-1 rounded text-sm font-bold ${getScoreBackground(applicationDetails.total_score)} ${getScoreColor(applicationDetails.total_score)}`}>
                            {applicationDetails.total_score}/100
                          </span>
                        </div>

                        {/* Individual Scores */}
                        <div className="space-y-1 text-xs">
                          {applicationDetails.hireability_percentage !== undefined && applicationDetails.hireability_percentage > 0 && (
                            <div className="flex justify-between">
                              <span>Job Match:</span>
                              <span className={getScoreColor(applicationDetails.hireability_percentage)}>
                                {applicationDetails.hireability_percentage}%
                              </span>
                            </div>
                          )}
                          {applicationDetails.experience !== undefined && applicationDetails.experience > 0 && (
                            <div className="flex justify-between">
                              <span>Experience:</span>
                              <span className={getScoreColor(applicationDetails.experience)}>
                                {applicationDetails.experience}/100
                              </span>
                            </div>
                          )}
                          {applicationDetails.skills !== undefined && applicationDetails.skills > 0 && (
                            <div className="flex justify-between">
                              <span>Skills:</span>
                              <span className={getScoreColor(applicationDetails.skills)}>
                                {applicationDetails.skills}/100
                              </span>
                            </div>
                          )}
                          {applicationDetails.education !== undefined && applicationDetails.education > 0 && (
                            <div className="flex justify-between">
                              <span>Education:</span>
                              <span className={getScoreColor(applicationDetails.education)}>
                                {applicationDetails.education}/100
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 border-t border-gray-600 pt-3 text-center">
                        <div className="text-yellow-400 text-sm">
                          Score calculation in progress...
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Scores will appear once resume processing is complete
                        </p>
                      </div>
                    )}

                    {applicationDetails.remarks && (
                      <div className="mt-3 border-t border-gray-600 pt-3">
                        <span className="block mb-1 font-medium">Remarks:</span>
                        <p className="text-gray-300 text-xs bg-gray-700 p-2 rounded">{applicationDetails.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-300">
                  {isJobActive ? (
                    <>
                      <p className="mb-4">Ready to apply?</p>
                      <div className="bg-gray-800 rounded-xl p-4">
                        <p className="text-sm">Make sure you have uploaded your resume before applying. Once you apply, your application will be reviewed and scored based on:</p>
                        <ul className="text-xs mt-2 space-y-1 text-left">
                          <li>• Job compatibility match</li>
                          <li>• Relevant experience</li>
                          <li>• Required skills</li>
                          <li>• Educational background</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mb-4">Position Unavailable</p>
                      <div className="bg-gray-800 rounded-xl p-4">
                        <p className="text-sm">This job is no longer accepting applications. Check out other available positions on the Jobs page.</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-300">
              <p className="mb-4">Login to apply for this job</p>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-sm">
                  {isJobActive 
                    ? "Create an account and upload your resume to start applying for jobs. Your applications will be automatically scored and reviewed."
                    : "This job is no longer accepting applications, but you can still create an account to apply for other available positions."
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default JobDetailsPage