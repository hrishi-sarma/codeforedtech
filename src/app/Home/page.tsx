'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, uploadResume, getResumeUrl, downloadResume, checkIfUserIsAdmin } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

const Dashboard: React.FC = () => {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [resumeUrl, setResumeUrl] = useState<string | null>(null)
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

  useEffect(() => {
    const initializeData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser) {
          setUser(currentUser)
          
          // Check if user is admin
          const adminStatus = await checkIfUserIsAdmin()
          setIsAdmin(adminStatus)
          
          // Only check for resume if not admin
          if (!adminStatus) {
            const existingResumeUrl = await getResumeUrl(currentUser.id)
            setResumeUrl(existingResumeUrl)
          }
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeData()
  }, [])

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      
      // Validate file type - now accepts PDF, DOC, and DOCX
      if (!isValidFileType(file)) {
        const extension = getFileExtension(file.name)
        setUploadMessage(`❌ Invalid file type: .${extension}. Please select PDF, DOC, or DOCX files only`)
        return
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        setUploadMessage('❌ File size must be less than 5MB')
        return
      }

      setUploading(true)
      setUploadMessage('')

      try {
        console.log('Starting resume upload:', file.name, 'Type:', file.type)
        const result = await uploadResume(file)
        
        if (result.success) {
          setResumeUrl(result.url)
          setUploadMessage(`✅ Resume uploaded successfully: ${result.fileName}`)
          
          // Clear the message after 3 seconds
          setTimeout(() => {
            setUploadMessage('')
          }, 3000)
        }
      } catch (error: any) {
        console.error('Resume upload error:', error)
        setUploadMessage(`❌ Upload failed: ${error.message}`)
      } finally {
        setUploading(false)
        // Reset the file input
        e.target.value = ''
      }
    }
  }

  const handleDownloadResume = async () => {
    try {
      await downloadResume()
    } catch (error: any) {
      console.error('Download error:', error)
      alert(`Failed to download resume: ${error.message}`)
    }
  }

  const handleAddNewJob = () => {
    router.push('/Admindash')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-mono">Loading your homepage...</div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-screen  rounded-2xl p-6"
      style={{ fontFamily: "'Comic Neue', cursive" }}
    >
      {/* Welcome message */}
      <h1 className="text-4xl font-bold mb-12 text-center">
        Welcome {isAdmin ? 'Admin' : ''} {user?.email?.split('@')[0] || 'User'}
      </h1>

      {isAdmin ? (
        // Admin Dashboard Content
        <div className="text-center">
          <div className="mb-8">
            <div className="text-lg text-gray-700 mb-6">
              Manage job postings and view applications from your admin dashboard.
            </div>
          </div>

          {/* Add New Job Button */}
          <button
            onClick={handleAddNewJob}
            className="px-6 py-3 rounded-lg border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-colors shadow-lg"
          >
            Add New Jobs
          </button>

          {/* Admin Instructions */}
          <div className="mt-6 text-sm text-gray-600 text-center max-w-md">
            <p>🛠️ Create and manage job postings</p>
            <p>📊 View application analytics</p>
            <p>👥 Review candidate applications</p>
          </div>
        </div>
      ) : (
        // Regular User Dashboard Content
        <div className="text-center">
          {/* Resume Status */}
          {resumeUrl && (
            <div className="mb-8 text-center">
              <div className="text-green-600 font-semibold mb-3">
                ✅ Resume uploaded successfully!
              </div>
              <button
                onClick={handleDownloadResume}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                Download Current Resume
              </button>
              
            </div>
          )}

          {/* Upload button */}
          <label className={`px-6 py-3 rounded-lg cursor-pointer border-2 border-black transition-colors shadow-lg ${
            uploading 
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
              : 'bg-black text-white hover:bg-white hover:text-black'
          }`}>
            {uploading ? 'Uploading...' : resumeUrl ? 'Replace Resume' : 'Upload Resume'}
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={uploading}
            />
          </label>

          {/* Upload message */}
          {uploadMessage && (
            <div className="mt-4 p-3 rounded-lg bg-gray-100 text-center max-w-md">
              {uploadMessage}
            </div>
          )}

          {/* File requirements */}
          <div className="mt-6 text-sm text-gray-600 text-center max-w-md">
            
            <p> Maximum file size: 5MB</p>
            
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard