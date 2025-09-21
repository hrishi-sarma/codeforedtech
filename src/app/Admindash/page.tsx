'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  getCurrentUser, 
  checkIfUserIsAdmin,
  getJobsForAdmin,
  updateJobStatus,
  deleteJobWithPdfs,
  createNewJobWithPdf
} from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

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

// Updated API configuration with better error handling
const JD_PARSER_ENDPOINTS = [
  'http://127.0.0.1:8000',
  'http://localhost:8000',
  'http://0.0.0.0:8000'  // Added this as another option
]

const AdminDashboard: React.FC = () => {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  // Helper function to check if file type is allowed
  const isValidFileType = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ]
    return allowedTypes.includes(file.type)
  }

  // Helper function to get file extension
  const getFileExtension = (fileName: string) => {
    return fileName.split('.').pop()?.toLowerCase() || ''
  }

  // Helper function to get file type display name
  const getFileTypeDisplay = (file: File) => {
    const extension = getFileExtension(file.name).toUpperCase()
    if (file.type === 'application/pdf') return 'PDF'
    if (file.type === 'application/msword') return 'DOC'
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'DOCX'
    return extension || 'Unknown'
  }

  // Improved function to test FastAPI connectivity
  const testFastAPIConnection = async () => {
    for (const endpoint of JD_PARSER_ENDPOINTS) {
      try {
        console.log(`Testing connection to: ${endpoint}`)
        
        const response = await fetch(`${endpoint}/docs`, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout for test
        })

        if (response.ok) {
          console.log(`✅ Successfully connected to: ${endpoint}`)
          return endpoint
        } else {
          console.log(`❌ ${endpoint} returned ${response.status}`)
        }
      } catch (error) {
        console.log(`❌ Failed to connect to ${endpoint}:`, error)
      }
    }
    return null
  }

  // Enhanced function to call the FastAPI JD Parser
  const processJobWithFastAPI = async (jobId: number) => {
    try {
      console.log(`🔄 Starting FastAPI processing for job ID: ${jobId}`)
      
      // First test connectivity
      const workingEndpoint = await testFastAPIConnection()
      if (!workingEndpoint) {
        throw new Error('❌ Cannot connect to FastAPI server on any endpoint. Please ensure:\n\n1. FastAPI server is running: python jd_parser_out.py\n2. Server is accessible on port 8000\n3. No firewall is blocking the connection\n4. Check terminal for any FastAPI startup errors')
      }

      console.log(`✅ Using working endpoint: ${workingEndpoint}`)
      
      const formData = new FormData()
      formData.append('job_id', jobId.toString())

      console.log(`📤 Sending POST request to: ${workingEndpoint}/update_job`)
      
      const response = await fetch(`${workingEndpoint}/update_job`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(120000) // Increased timeout to 2 minutes
      })

      console.log(`📥 Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ FastAPI Error Response:`, errorText)
        throw new Error(`FastAPI returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log(`✅ FastAPI processing successful:`, result)
      
      if (result.status !== 'success') {
        throw new Error(result.detail || 'FastAPI processing failed with unknown error')
      }

      return result
    } catch (error) {
      console.error('❌ Error in FastAPI processing:', error)
      
      // Provide more specific error messages
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('🌐 Network Error: Cannot reach FastAPI server.\n\nTroubleshooting:\n• Is the FastAPI server running? Run: python jd_parser_out.py\n• Check if port 8000 is available\n• Try restarting the FastAPI server')
      } else if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('⏰ Request Timeout: FastAPI processing took longer than 2 minutes.\n\nThis might be due to:\n• Large document size\n• AI model processing delay\n• Server performance issues\n\nTry again with a smaller document.')
      } else if (error instanceof Error) {
        throw error
      } else {
        throw new Error('🔥 Unknown error occurred during FastAPI processing')
      }
    }
  }

  useEffect(() => {
    const initializeAdmin = async () => {
      try {
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
        await loadJobs()
      } catch (error) {
        console.error('Error initializing admin:', error)
        router.push('/Home')
      } finally {
        setLoading(false)
      }
    }

    initializeAdmin()
  }, [router])

  const loadJobs = async () => {
    try {
      const jobData = await getJobsForAdmin()
      setJobs(jobData)
    } catch (error) {
      console.error('Error loading jobs:', error)
    }
  }

  const handleStatusChange = async (jobId: number, newStatus: string) => {
    try {
      await updateJobStatus(jobId, newStatus)
      await loadJobs() // Reload jobs
    } catch (error) {
      console.error('Error updating job status:', error)
      alert('Failed to update job status')
    }
  }

  const handleDeleteJob = async (jobId: number) => {
    if (window.confirm('Are you sure you want to delete this job? This will also delete all applications and associated files.')) {
      try {
        await deleteJobWithPdfs(jobId)
        await loadJobs() // Reload jobs
        alert('Job and associated files deleted successfully')
      } catch (error) {
        console.error('Error deleting job:', error)
        alert('Failed to delete job')
      }
    }
  }

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      
      // Validate file type - now accepts PDF, DOC, and DOCX
      if (!isValidFileType(file)) {
        const extension = getFileExtension(file.name)
        setUploadMessage(`❌ Invalid file type: .${extension}. Please select PDF, DOC, or DOCX files only`)
        e.target.value = ''
        return
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        setUploadMessage('❌ File size must be less than 10MB')
        e.target.value = ''
        return
      }

      setSelectedPdfFile(file)
      setUploadMessage('')
    }
  }

  const handleUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedPdfFile) {
      setUploadMessage('❌ Please select a file')
      return
    }

    setUploading(true)
    const fileType = getFileTypeDisplay(selectedPdfFile)
    let createdJobId: number | null = null

    try {
      // Step 1: Create job record and upload document to Supabase
      setUploadMessage(`📤 Step 1/4: Creating job record and uploading ${fileType} file...`)
      
      const tempJobData = {
        title: `Processing: ${selectedPdfFile.name}`,
        detailed_description: `AI will extract job details from the uploaded ${fileType} file...`,
        criteria: 'Processing...',
        company_name: 'Processing...',
        salary_range: undefined
      }

      const result = await createNewJobWithPdf(tempJobData, selectedPdfFile)

      if (!result.success) {
        throw new Error(`Failed to create job with ${fileType} file`)
      }

      createdJobId = result.job.id
      console.log('✅ Job created successfully with ID:', createdJobId)
      console.log('📄 Document uploaded to:', result.pdf?.url)

      // Step 2: Test FastAPI connectivity
      setUploadMessage(`🔍 Step 2/4: Testing AI server connection...`)
      
      const workingEndpoint = await testFastAPIConnection()
      if (!workingEndpoint) {
        throw new Error('Cannot connect to FastAPI server. Please ensure the AI processing server is running on port 8000.')
      }

      // Step 3: Process the job using FastAPI
      setUploadMessage(`🤖 Step 3/4: AI is analyzing the ${fileType} content...`)
      
      const fastApiResult = await processJobWithFastAPI(createdJobId)
      console.log('✅ FastAPI processing result:', fastApiResult)

      // Step 4: Update job status to inactive after successful processing
      setUploadMessage(`✨ Step 4/4: Finalizing job details...`)
      
      // Import Supabase client to update job status
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await supabase
        .from('jobs')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', createdJobId)

      // Success! Show completion message
      setUploadMessage('🎉 Job processed successfully! Refreshing dashboard...')
      
      // Wait a moment to show the success message
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Reload jobs to show updated information
      await loadJobs()

      // Close the form and reset states
      setSelectedPdfFile(null)
      setShowUploadForm(false)
      setUploadMessage('')
      
      // Show success message with details
      const updatedJob = fastApiResult.updated_row?.[0]
      const structuredJson = fastApiResult.structured_json
      
      alert(`🎉 Job created and processed successfully! 

📋 Job Details:
• Job ID: ${createdJobId}
• Company: ${structuredJson?.['Company Name'] || updatedJob?.company_name || 'Unknown'}
• Title: ${updatedJob?.title || 'Position'}
• File: ${selectedPdfFile.name}
• Document URL: ${result.pdf?.url || 'Stored securely'}

✅ Status: Created as INACTIVE
📝 Next Step: Review extracted details and activate when ready.`)
    
    } catch (error) {
      console.error('❌ Error in upload process:', error)
      
      // If we created a job but failed to process, inform the admin
      if (createdJobId) {
        setUploadMessage(`⚠️ Document uploaded but AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Job ${createdJobId} was created but needs manual review.`)
        
        // Still reload jobs to show the created job
        await loadJobs()
        
        alert(`⚠️ Partial Success:

✅ Document Upload: Success
❌ AI Processing: Failed

📋 Details:
• Job ID: ${createdJobId} was created successfully
• Document was uploaded to secure storage
• Error: ${error instanceof Error ? error.message : 'Unknown error'}

📝 Next Steps:
• You can manually edit the job details in the dashboard
• Or try processing again after fixing the FastAPI server
• The document is safely stored and won't be lost`)
      } else {
        setUploadMessage(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        
        alert(`❌ Upload Failed:

${error instanceof Error ? error.message : 'Unknown error'}

💡 If this is a FastAPI connection error:
1. Make sure FastAPI server is running: python jd_parser_out.py
2. Check terminal for any errors
3. Try restarting the server
4. Ensure port 8000 is not blocked`)
      }
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-mono">Loading admin dashboard...</div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-white flex flex-col items-center justify-center p-6"
      style={{ fontFamily: "'Comic Neue', cursive" }}
    >
      <div className="w-full max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
          <div className="text-lg text-gray-600">Welcome, {user?.email?.split('@')[0]}</div>
        </div>

        {/* Upload Job File Button */}
        <div className="text-center mb-8">
          <button 
            onClick={() => setShowUploadForm(true)}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-white hover:text-black border-2 border-black transition-colors shadow-lg font-semibold"
          >
            Upload Job Document
          </button>
          <div className="text-sm text-gray-600 mt-2">
            Upload a PDF, DOC, or DOCX file and AI will automatically extract job details
          </div>
        </div>

        {/* Jobs List Container */}
        <div className="bg-gray-50 rounded-2xl p-6 max-h-[60vh] overflow-y-auto border-2 border-black">
          {jobs.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <div className="text-xl mb-4">No jobs found</div>
              <div className="text-sm">Upload a job document to create your first job posting</div>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div 
                  key={job.id}
                  className="bg-white border-2 border-black rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold">
                        {job.company_name && !job.company_name.includes('Processing') 
                          ? job.company_name 
                          : 'Processing...'
                        }
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        job.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : job.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="text-gray-600 mb-2">
                      <strong>{job.title && !job.title.includes('Processing') 
                        ? job.title 
                        : 'AI Processing...'
                      }</strong>
                      {job.salary_range && <span className="ml-4">💰 {job.salary_range}</span>}
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed mb-2">
                      {job.detailed_description 
                        ? (job.detailed_description.length > 200 
                            ? `${job.detailed_description.substring(0, 200)}...`
                            : job.detailed_description)
                        : 'AI is processing the job description...'
                      }
                    </p>
                    <div className="text-xs text-gray-500">
                      <div>Applications: {job.applications_count} | Created: {new Date(job.created_at).toLocaleDateString()} | Job ID: {job.id}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    <button 
                      onClick={() => router.push(`/AdminJobs/${job.id}`)}
                      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                    >
                      View Details
                    </button>
                    
                    {job.status !== 'processing' && !job.company_name?.includes('Processing') && (
                      <button 
                        onClick={() => handleStatusChange(job.id, job.status === 'active' ? 'inactive' : 'active')}
                        className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                          job.status === 'active'
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        {job.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleDeleteJob(job.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="mt-8 grid grid-cols-4 gap-4 max-w-3xl mx-auto">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{jobs.length}</div>
            <div className="text-sm text-blue-800">Total Jobs</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">
              {jobs.filter(job => job.status === 'active').length}
            </div>
            <div className="text-sm text-green-800">Active Jobs</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">
              {jobs.filter(job => job.status === 'inactive').length}
            </div>
            <div className="text-sm text-orange-800">Inactive Jobs</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">
              {jobs.reduce((sum, job) => sum + job.applications_count, 0)}
            </div>
            <div className="text-sm text-purple-800">Total Applications</div>
          </div>
        </div>
      </div>

      {/* Upload File Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black text-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md border-2 border-black">
            <h2 className="text-2xl font-bold mb-6 text-center">Upload Job Document</h2>
            
            <form onSubmit={handleUploadPdf} className="space-y-6">
              <div>
                <label className="block text-lg font-semibold mb-3">Select Job Description File</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handlePdfFileChange}
                  className="w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={uploading}
                  required
                />
                
                {selectedPdfFile && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm">
                    <div className="font-medium">Selected: {selectedPdfFile.name}</div>
                    <div className="text-gray-600">
                      Type: {getFileTypeDisplay(selectedPdfFile)} | Size: {(selectedPdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                )}
                
                <div className="mt-3 text-sm text-gray-600">
                  <div>• Accepted formats: PDF, DOC, DOCX (Max 10MB)</div>
                  <div>• Document will be uploaded to secure storage</div>
                  <div>• FastAPI will extract company, criteria, and salary</div>
                  <div>• Processing may take 30-120 seconds</div>
                  <div className="font-medium text-orange-600">• Job will be created as INACTIVE by default</div>
                </div>
              </div>

              {uploadMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  uploadMessage.includes('failed') || uploadMessage.includes('Please select') || uploadMessage.includes('Invalid') || uploadMessage.includes('❌')
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : uploadMessage.includes('successfully') || uploadMessage.includes('🎉')
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : uploadMessage.includes('⚠️')
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                    : 'bg-blue-50 border border-blue-200 text-blue-700'
                }`}>
                  {uploadMessage}
                </div>
              )}

              <div className="flex gap-4">
                
                <button
                  type="submit"
                  disabled={uploading || !selectedPdfFile}
                  className="flex-1 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading 
                    ? (uploadMessage.includes('🎉') || uploadMessage.includes('successfully') 
                        ? 'Processed!' 
                        : uploadMessage.includes('Step 1')
                        ? 'Uploading...'
                        : uploadMessage.includes('Step 2') 
                        ? 'Testing Connection...'
                        : uploadMessage.includes('Step 3')
                        ? 'AI Processing...'
                        : uploadMessage.includes('Step 4')
                        ? 'Finalizing...'
                        : 'Processing...')
                    : '🚀 Upload & Process'
                  }
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false)
                    setSelectedPdfFile(null)
                    setUploadMessage('')
                  }}
                  disabled={uploading}
                  className="flex-1 py-3 bg-gray-300 text-black rounded-lg font-semibold hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard