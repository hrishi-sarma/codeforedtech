'use client'



import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'



// Create typed Supabase client

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!



export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {

  auth: {

    autoRefreshToken: true,

    persistSession: true,

    detectSessionInUrl: true,

  },

})



/* -----------------------------

   AUTH HELPERS

--------------------------------*/

export const signInWithGoogle = async () => {

  const { data, error } = await supabase.auth.signInWithOAuth({

    provider: 'google',

    options: {

      redirectTo: `${window.location.origin}/auth/callback`,

    },

  })

  if (error) throw error

  return data

}



export const signInWithEmail = async (email: string, password: string) => {

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) throw error

  return data

}



export const signUpWithEmail = async (email: string, password: string) => {

  const { data, error } = await supabase.auth.signUp({

    email,

    password,

    options: {

      emailRedirectTo: `${window.location.origin}/Home`,

    },

  })

  if (error) throw error

  return data

}



export const signOut = async () => {

  const { error } = await supabase.auth.signOut()

  if (error) throw error

}



/* -----------------------------

   USER HELPERS

--------------------------------*/

export const getCurrentUser = async () => {

  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) throw error

  return session?.user ?? null

}



/* -----------------------------

   DATABASE HELPERS

--------------------------------*/



// Helper function to update job application count based on actual database data

export const updateJobApplicationCount = async (jobId: number) => {

  try {

    const { count, error: countError } = await supabase

      .from('job_applications')

      .select('*', { count: 'exact', head: true })

      .eq('job_id', jobId)



    if (countError) {

      console.error('Error getting application count:', countError)

      return false

    }



    const { error: updateError } = await supabase

      .from('jobs')

      .update({ 

        applications_count: count || 0,

        updated_at: new Date().toISOString()

      })

      .eq('id', jobId)



    if (updateError) {

      console.error('Error updating job application count:', updateError)

      return false

    }



    console.log(`Updated job ${jobId} applications count to: ${count}`)

    return true

  } catch (error) {

    console.error('Error in updateJobApplicationCount:', error)

    return false

  }

}



// Helper function to sync all job application counts

export const syncAllJobApplicationCounts = async () => {

  try {

    console.log('Syncing all job application counts...')

    

    // Get all jobs

    const { data: jobs, error: jobsError } = await supabase

      .from('jobs')

      .select('id')



    if (jobsError) {

      console.error('Error fetching jobs for sync:', jobsError)

      return false

    }



    // Update count for each job

    const updatePromises = jobs?.map(job => updateJobApplicationCount(job.id)) || []

    await Promise.all(updatePromises)

    

    console.log('Job application counts synced successfully')

    return true

  } catch (error) {

    console.error('Error syncing job application counts:', error)

    return false

  }

}



/* -----------------------------

   ADMIN HELPERS

--------------------------------*/

export const checkIfUserIsAdmin = async () => {

  try {

    const user = await getCurrentUser()

    if (!user) return false



    const { data, error } = await supabase.rpc('is_admin')

    

    if (error) {

      console.error('Error checking admin status:', error)

      return false

    }

    

    return data || false

  } catch (error) {

    console.error('Error in checkIfUserIsAdmin:', error)

    return false

  }

}



export const getUserRole = async () => {

  try {

    const user = await getCurrentUser()

    if (!user) return 'guest'



    const { data: profile, error } = await supabase

      .from('user_profiles')

      .select('role')

      .eq('id', user.id)

      .maybeSingle()



    if (error) {

      console.error('Error getting user role:', error)

      return 'user'

    }



    return profile?.role || 'user'

  } catch (error) {

    console.error('Error in getUserRole:', error)

    return 'user'

  }

}



export const makeUserAdmin = async (userEmail: string) => {

  try {

    const { data, error } = await supabase.rpc('make_user_admin', {

      user_email: userEmail

    })



    if (error) {

      throw new Error(`Failed to make user admin: ${error.message}`)

    }



    return { success: true, message: data }

  } catch (error) {

    console.error('Error in makeUserAdmin:', error)

    throw error

  }

}



// Admin job management functions

export const getJobsForAdmin = async () => {

  try {

    // Sync application counts first

    await syncAllJobApplicationCounts()

    

    const { data, error } = await supabase

      .from('jobs')

      .select('*')

      .order('created_at', { ascending: false })



    if (error) {

      throw new Error(`Failed to fetch jobs: ${error.message}`)

    }



    return data || []

  } catch (error) {

    console.error('Error in getJobsForAdmin:', error)

    throw error

  }

}



export const updateJobStatus = async (jobId: number, newStatus: string) => {

  try {

    const { data, error } = await supabase

      .from('jobs')

      .update({ 

        status: newStatus,

        updated_at: new Date().toISOString()

      })

      .eq('id', jobId)

      .select()



    if (error) {

      throw new Error(`Failed to update job status: ${error.message}`)

    }



    // Update the application count while we're at it

    await updateJobApplicationCount(jobId)



    return data

  } catch (error) {

    console.error('Error in updateJobStatus:', error)

    throw error

  }

}



export const deleteJob = async (jobId: number) => {

  try {

    // First delete related job applications

    await supabase

      .from('job_applications')

      .delete()

      .eq('job_id', jobId)



    // Then delete the job

    const { data, error } = await supabase

      .from('jobs')

      .delete()

      .eq('id', jobId)

      .select()



    if (error) {

      throw new Error(`Failed to delete job: ${error.message}`)

    }



    return data

  } catch (error) {

    console.error('Error in deleteJob:', error)

    throw error

  }

}



export const createNewJob = async (jobData: {

  title: string

  detailed_description: string

  criteria: string

  company_name: string

  salary_range?: string

}) => {

  try {

    const { data, error } = await supabase

      .from('jobs')

      .insert({

        ...jobData,

        status: 'inactive', // CHANGED: Default to inactive instead of active

        applications_count: 0, // Start with 0, will be updated as people apply

        created_at: new Date().toISOString(),

        updated_at: new Date().toISOString()

      })

      .select()



    if (error) {

      throw new Error(`Failed to create job: ${error.message}`)

    }



    return data

  } catch (error) {

    console.error('Error in createNewJob:', error)

    throw error

  }

}



/* -----------------------------

   JOB PDF HELPERS

--------------------------------*/



// Add this function to your supabaseClient.ts if it's missing:



export const createNewJobWithPdf = async (jobData: {

  title: string

  detailed_description: string

  criteria: string

  company_name: string

  salary_range?: string

}, documentFile?: File) => {

  try {

    console.log('=== CREATING NEW JOB WITH DOCUMENT ===')

    

    // STEP 1: Create job record first with processing status

    console.log('Step 1: Creating job record...')

    const { data: jobRecord, error: jobError } = await supabase

      .from('jobs')

      .insert({

        ...jobData,

        status: 'processing', // Start as processing during upload

        applications_count: 0,

        created_at: new Date().toISOString(),

        updated_at: new Date().toISOString()

      })

      .select()



    if (jobError) {

      throw new Error(`Failed to create job: ${jobError.message}`)

    }



    const newJob = jobRecord[0]

    console.log('Job created successfully with ID:', newJob.id)



    let documentResult = null

    

    // STEP 2: Upload document if provided

    if (documentFile) {

      try {

        console.log('Step 2: Uploading document for job ID:', newJob.id)

        documentResult = await uploadJobPdf(documentFile, newJob.id) // This function now handles multiple formats

        console.log('Job document uploaded successfully:', documentResult)

        

        // STEP 3: Update job status to inactive after successful document upload

        console.log('Step 3: Updating job status to inactive...')

        const { error: statusError } = await supabase

          .from('jobs')

          .update({ 

            status: 'inactive', // Set to inactive instead of active

            updated_at: new Date().toISOString()

          })

          .eq('id', newJob.id)



        if (statusError) {

          console.error('Failed to update job status:', statusError)

          // Don't throw error here, job was created successfully

        } else {

          // Update the job record status in our return data

          newJob.status = 'inactive'

        }

        

      } catch (documentError) {

        console.error('Failed to upload job document:', documentError)

        // Keep the job but mark it as having an error

        await supabase

          .from('jobs')

          .update({ 

            status: 'inactive',

            detailed_description: 'Error uploading document: ' + (documentError instanceof Error ? documentError.message : 'Unknown error'),

            updated_at: new Date().toISOString()

          })

          .eq('id', newJob.id)

      }

    } else {

      // No document provided, just set to inactive

      await supabase

        .from('jobs')

        .update({ 

          status: 'inactive',

          updated_at: new Date().toISOString()

        })

        .eq('id', newJob.id)

      newJob.status = 'inactive'

    }



    console.log('=== JOB CREATION COMPLETE ===')

    

    return {

      job: newJob,

      pdf: documentResult, // Renamed from pdf to document for clarity

      success: true

    }

  } catch (error) {

    console.error('Error in createNewJobWithPdf:', error)

    throw error

  }

}



export const getJobPdfs = async (jobId: number) => {

  try {

    const { data, error } = await supabase

      .from('job_pdfs')

      .select('*')

      .eq('job_id', jobId)

      .order('created_at', { ascending: false })



    if (error) {

      console.error('Error fetching job PDFs:', error)

      throw error

    }



    return data || []

  } catch (error) {

    console.error('Error in getJobPdfs:', error)

    throw error

  }

}



export const deleteJobPdf = async (pdfId: number) => {

  try {

    const user = await getCurrentUser()

    if (!user) {

      throw new Error('You must be logged in to delete job PDFs')

    }

    

    const isAdmin = await checkIfUserIsAdmin()

    if (!isAdmin) {

      throw new Error('Only admins can delete job PDFs')

    }



    // Get PDF info before deleting

    const { data: pdfInfo, error: fetchError } = await supabase

      .from('job_pdfs')

      .select('job_pdf_url, job_id')

      .eq('id', pdfId)

      .single()



    if (fetchError) {

      console.error('Error fetching PDF info:', fetchError)

      throw new Error(`Failed to fetch PDF info: ${fetchError.message}`)

    }



    // Extract filename from URL to delete from storage

    const url = pdfInfo.job_pdf_url

    if (url.includes('/job-pdfs/')) {

      const jobPdfsIndex = url.indexOf('/job-pdfs/') + '/job-pdfs/'.length

      const pathAfterJobPdfs = url.substring(jobPdfsIndex)

      const fileName = pathAfterJobPdfs.split('?')[0] // Remove query parameters

      

      // Delete from storage

      await supabase.storage

        .from('job-pdfs')

        .remove([fileName])

    }



    // Delete from database

    const { error: deleteError } = await supabase

      .from('job_pdfs')

      .delete()

      .eq('id', pdfId)



    if (deleteError) {

      console.error('Error deleting job PDF:', deleteError)

      throw new Error(`Failed to delete PDF: ${deleteError.message}`)

    }



    return { success: true }

  } catch (error) {

    console.error('Error in deleteJobPdf:', error)

    throw error

  }

}



export const deleteJobWithPdfs = async (jobId: number) => {

  try {

    console.log('=== DELETING JOB WITH PDFS ===')

    

    // Step 1: Get and delete all PDFs for this job

    console.log('Step 1: Getting job PDFs...')

    const jobPdfs = await getJobPdfs(jobId)

    console.log(`Found ${jobPdfs.length} PDFs to delete`)

    

    for (const pdf of jobPdfs) {

      console.log(`Deleting PDF: ${pdf.file_name}`)

      await deleteJobPdf(pdf.id)

    }



    // Step 2: Delete job applications

    console.log('Step 2: Deleting job applications...')

    await supabase

      .from('job_applications')

      .delete()

      .eq('job_id', jobId)



    // Step 3: Delete the job

    console.log('Step 3: Deleting job record...')

    const { data, error } = await supabase

      .from('jobs')

      .delete()

      .eq('id', jobId)

      .select()



    if (error) {

      throw new Error(`Failed to delete job: ${error.message}`)

    }



    console.log('=== JOB DELETION COMPLETE ===')

    return data

  } catch (error) {

    console.error('Error in deleteJobWithPdfs:', error)

    throw error

  }

}



export const downloadJobPdf = async (pdfId: number) => {

  try {

    console.log('=== JOB PDF DOWNLOAD DEBUG START ===')

    console.log('PDF ID:', pdfId)



    // Get the PDF info from database

    const { data: pdfInfo, error: pdfError } = await supabase

      .from('job_pdfs')

      .select('job_pdf_url, file_name')

      .eq('id', pdfId)

      .single()



    if (pdfError) {

      console.error('PDF fetch error:', pdfError)

      throw new Error(`Failed to get PDF info: ${pdfError.message}`)

    }



    console.log('PDF info:', pdfInfo)



    if (!pdfInfo?.job_pdf_url) {

      throw new Error('No PDF URL found')

    }



    // Extract the file path from the URL

    let fullPath = ''

    if (pdfInfo.job_pdf_url.includes('/job-pdfs/')) {

      const jobPdfsIndex = pdfInfo.job_pdf_url.indexOf('/job-pdfs/') + '/job-pdfs/'.length

      const pathAfterJobPdfs = pdfInfo.job_pdf_url.substring(jobPdfsIndex)

      fullPath = pathAfterJobPdfs.split('?')[0] // Remove query parameters

    }



    console.log('Extracted path:', fullPath)



    if (!fullPath) {

      throw new Error('Could not determine PDF file path from URL')

    }



    // Download the file from storage

    console.log('=== ATTEMPTING DOWNLOAD ===')

    const { data, error } = await supabase.storage

      .from('job-pdfs')

      .download(fullPath)



    if (error) {

      console.error('Download error:', error)

      throw new Error(`Failed to download PDF: ${error.message}`)

    }



    // Create blob URL for download

    console.log('=== CREATING DOWNLOAD LINK ===')

    const url = URL.createObjectURL(data)

    const a = document.createElement('a')

    a.href = url

    a.download = pdfInfo.file_name || 'job_description.pdf'

    document.body.appendChild(a)

    a.click()

    document.body.removeChild(a)

    URL.revokeObjectURL(url)



    console.log('=== JOB PDF DOWNLOAD COMPLETE ===')

    return { success: true }

  } catch (error) {

    console.error('=== JOB PDF DOWNLOAD FAILED ===')

    console.error('Error in downloadJobPdf:', error)

    throw error

  }

}



/* -----------------------------

   RESUME HELPERS

--------------------------------*/

const isValidDocumentType = (file: File) => {

  const allowedTypes = [

    'application/pdf',

    'application/msword', // .doc

    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx

  ]

  return allowedTypes.includes(file.type)

}



// Helper function to get proper content type for storage

const getContentType = (file: File) => {

  if (file.type === 'application/pdf') return 'application/pdf'

  if (file.type === 'application/msword') return 'application/msword'

  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {

    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  }

  return 'application/octet-stream' // fallback

}



// Helper function to get file extension

const getFileExtension = (fileName: string) => {

  return fileName.split('.').pop()?.toLowerCase() || ''

}



// Updated uploadResume function to handle multiple file types

export const uploadResume = async (file: File) => {

  try {

    console.log('Starting resume upload process...')

    const user = await getCurrentUser()

    if (!user) {

      throw new Error('You must be logged in to upload a resume')

    }

    console.log('User authenticated:', user.id)



    // Validate file type - now accepts PDF, DOC, and DOCX

    console.log('File type:', file.type, 'File size:', file.size)

    if (!isValidDocumentType(file)) {

      const extension = getFileExtension(file.name)

      throw new Error(`Invalid file type: .${extension}. Only PDF, DOC, and DOCX files are allowed`)

    }



    // Validate file size (max 5MB)

    const maxSize = 5 * 1024 * 1024 // 5MB

    if (file.size > maxSize) {

      throw new Error('File size must be less than 5MB')

    }



    // STEP 1: Delete existing files

    console.log('=== STEP 1: DELETING EXISTING FILES ===')

    await deleteAllUserResumes(user.id)



    // Wait for delete operations to complete

    await new Promise(resolve => setTimeout(resolve, 2000))



    // STEP 2: Create unique filename with timestamp and proper extension

    const timestamp = Date.now()

    const fileExtension = getFileExtension(file.name) || 'pdf'

    const uniqueFileName = `${user.id}/resume_${timestamp}.${fileExtension}`

    console.log('=== STEP 2: UPLOADING NEW FILE ===')

    console.log('Uploading to path:', uniqueFileName)



    // Upload file to storage with proper content type

    const { data: uploadData, error: uploadError } = await supabase.storage

      .from('resumes')

      .upload(uniqueFileName, file, {

        contentType: getContentType(file),

        cacheControl: '0'

      })



    if (uploadError) {

      console.error('Storage upload error:', uploadError)

      throw new Error(`Failed to upload to storage: ${uploadError.message}`)

    }



    console.log('File uploaded to storage successfully:', uploadData)



    // STEP 3: Get the signed URL

    console.log('=== STEP 3: GENERATING SIGNED URL ===')

    const { data: signedUrlData, error: urlError } = await supabase.storage

      .from('resumes')

      .createSignedUrl(uniqueFileName, 60 * 60 * 24 * 365) // 1 year expiry



    let finalUrl: string



    if (urlError) {

      console.error('URL generation error:', urlError)

      // Fall back to public URL

      const { data: publicUrlData } = supabase.storage

        .from('resumes')

        .getPublicUrl(uniqueFileName)

      

      console.log('Using public URL fallback:', publicUrlData.publicUrl)

      finalUrl = publicUrlData.publicUrl

    } else {

      console.log('Generated signed URL:', signedUrlData.signedUrl)

      finalUrl = signedUrlData.signedUrl

    }



    // STEP 4: Update user profile

    console.log('=== STEP 4: UPDATING DATABASE ===')

    

    const profileData = {

      id: user.id,

      resume_url: finalUrl,

      updated_at: new Date().toISOString(),

      role: 'user',

      created_at: new Date().toISOString()

    }



    const { error: updateError, data: updateData } = await supabase

      .from('user_profiles')

      .upsert(profileData, {

        onConflict: 'id'

      })

      .select()



    if (updateError) {

      console.error('Profile update error:', updateError)

      throw new Error(`Failed to update profile: ${updateError.message}`)

    }



    console.log('User profile updated successfully:', updateData)

    console.log('=== UPLOAD COMPLETE ===')

    

    return {

      success: true,

      url: finalUrl,

      fileName: file.name

    }



  } catch (error) {

    console.error('Error in uploadResume:', error)

    throw error

  }

}



// Updated uploadJobPdf function to handle multiple file types





export const deleteAllUserResumes = async (userId: string) => {

  try {

    console.log('=== COMPREHENSIVE DELETE PROCESS ===')

    

    // Step 1: List all files in user's folder

    console.log('Listing files in user folder...')

    const { data: fileList, error: listError } = await supabase.storage

      .from('resumes')

      .list(userId)



    if (listError) {

      console.log('Error listing files:', listError)

    } else {

      console.log('Found files:', fileList)

    }



    // Step 2: Delete all files found

    if (fileList && fileList.length > 0) {

      const filesToDelete = fileList.map(f => `${userId}/${f.name}`)

      console.log('Deleting files:', filesToDelete)

      

      const { data: deleteData, error: deleteError } = await supabase.storage

        .from('resumes')

        .remove(filesToDelete)



      if (deleteError) {

        console.log('Bulk delete error:', deleteError)

      } else {

        console.log('Bulk delete successful:', deleteData)

      }

    }



    // Step 3: Clear database URL

    console.log('Clearing database URL...')

    const { error: dbError } = await supabase

      .from('user_profiles')

      .update({ 

        resume_url: null,

        updated_at: new Date().toISOString()

      })

      .eq('id', userId)



    if (dbError) {

      console.log('Database clear error:', dbError)

    } else {

      console.log('Database URL cleared successfully')

    }



    console.log('=== DELETE PROCESS COMPLETE ===')



  } catch (error) {

    console.log('Error in deleteAllUserResumes:', error)

  }

}



export const deleteExistingResume = async (userId: string) => {

  await deleteAllUserResumes(userId)

}



export const getResumeUrl = async (userId?: string) => {

  try {

    const targetUserId = userId || (await getCurrentUser())?.id

    if (!targetUserId) return null



    const { data: profile, error } = await supabase

      .from('user_profiles')

      .select('resume_url')

      .eq('id', targetUserId)

      .maybeSingle()



    if (error) {

      console.error('Error fetching resume URL:', error)

      return null

    }



    return profile?.resume_url || null

  } catch (error) {

    console.error('Error in getResumeUrl:', error)

    return null

  }

}



// Update the downloadResume function in your supabaseClient.ts:



export const downloadResume = async (userId?: string) => {

  try {

    console.log('=== RESUME DOWNLOAD DEBUG START ===')

    const targetUserId = userId || (await getCurrentUser())?.id

    if (!targetUserId) {

      throw new Error('User ID is required')

    }

    console.log('Target User ID:', targetUserId)



    // Get the current resume URL from the database

    const { data: profile, error: profileError } = await supabase

      .from('user_profiles')

      .select('resume_url')

      .eq('id', targetUserId)

      .maybeSingle()



    if (profileError) {

      console.error('Profile fetch error:', profileError)

      throw new Error(`Failed to get user profile: ${profileError.message}`)

    }



    console.log('Profile data:', profile)



    if (!profile?.resume_url) {

      throw new Error('No resume found for this user')

    }



    console.log('Resume URL from database:', profile.resume_url)



    // Try to extract filename from URL

    let actualFileName = ''

    let fullPath = ''

    

    // Check if it's a signed URL or public URL

    if (profile.resume_url.includes('/resumes/')) {

      // Extract the path after /resumes/

      const resumesIndex = profile.resume_url.indexOf('/resumes/') + '/resumes/'.length

      const pathAfterResumes = profile.resume_url.substring(resumesIndex)

      

      // Remove query parameters if present

      fullPath = pathAfterResumes.split('?')[0]

      

      // Extract just the filename

      const pathParts = fullPath.split('/')

      if (pathParts.length >= 2) {

        actualFileName = pathParts[1] // Should be the actual filename

      }

    }



    console.log('Extracted full path:', fullPath)

    console.log('Extracted filename:', actualFileName)



    if (!fullPath) {

      throw new Error('Could not determine resume file path from URL')

    }



    // First, try to list files in the user's folder to verify what exists

    console.log('=== CHECKING STORAGE CONTENTS ===')

    const { data: fileList, error: listError } = await supabase.storage

      .from('resumes')

      .list(targetUserId)



    if (listError) {

      console.error('Error listing files:', listError)

    } else {

      console.log('Files in user folder:', fileList)

    }



    // Try downloading using the full path

    console.log('=== ATTEMPTING DOWNLOAD ===')

    console.log('Download path:', fullPath)



    const { data, error } = await supabase.storage

      .from('resumes')

      .download(fullPath)



    if (error) {

      console.error('Download error details:', error)

      

      // If the direct path failed, try different variations

      if (fileList && fileList.length > 0) {

        console.log('=== TRYING ALTERNATIVE PATHS ===')

        // Try the first file in the user's folder

        const firstFile = fileList[0]

        const alternativePath = `${targetUserId}/${firstFile.name}`

        console.log('Trying alternative path:', alternativePath)

        

        const { data: altData, error: altError } = await supabase.storage

          .from('resumes')

          .download(alternativePath)

          

        if (altError) {

          console.error('Alternative download also failed:', altError)

          throw new Error(`Failed to download resume: ${error.message}`)

        } else {

          console.log('Alternative download succeeded')

          // Use the alternative data and determine proper filename

          const properFileName = getProperDownloadFileName(firstFile.name)

          const url = URL.createObjectURL(altData)

          const a = document.createElement('a')

          a.href = url

          a.download = properFileName

          document.body.appendChild(a)

          a.click()

          document.body.removeChild(a)

          URL.revokeObjectURL(url)

          console.log('=== DOWNLOAD COMPLETE ===')

          return { success: true }

        }

      } else {

        throw new Error(`Failed to download resume: ${error.message}`)

      }

    }



    // Create blob URL for download with proper filename

    console.log('=== CREATING DOWNLOAD LINK ===')

    const properFileName = getProperDownloadFileName(actualFileName)

    const url = URL.createObjectURL(data)

    const a = document.createElement('a')

    a.href = url

    a.download = properFileName

    document.body.appendChild(a)

    a.click()

    document.body.removeChild(a)

    URL.revokeObjectURL(url)



    console.log('=== DOWNLOAD COMPLETE ===')

    return { success: true }

  } catch (error) {

    console.error('=== DOWNLOAD FAILED ===')

    console.error('Error in downloadResume:', error)

    throw error

  }

}



// Helper function to determine proper download filename

const getProperDownloadFileName = (storedFileName: string): string => {

  if (!storedFileName) {

    return 'resume.pdf' // default fallback

  }



  // Extract the file extension

  const extension = storedFileName.split('.').pop()?.toLowerCase()

  

  switch (extension) {

    case 'pdf':

      return 'resume.pdf'

    case 'doc':

      return 'resume.doc'

    case 'docx':

      return 'resume.docx'

    default:

      // If we can't determine the extension, try to preserve the original

      if (storedFileName.includes('.')) {

        return `resume.${extension}`

      }

      return 'resume.pdf' // fallback to PDF

  }

}



/* -----------------------------

   JOB AND APPLICATION HELPERS

--------------------------------*/





export const uploadJobPdf = async (file: File, jobId: number) => {

  try {

    console.log('Starting job document upload process...')

    const user = await getCurrentUser()

    if (!user) {

      throw new Error('You must be logged in to upload job documents')

    }

    

    const isAdmin = await checkIfUserIsAdmin()

    if (!isAdmin) {

      throw new Error('Only admins can upload job documents')

    }



    // Validate file type - now accepts PDF, DOC, and DOCX

    if (!isValidDocumentType(file)) {

      const extension = getFileExtension(file.name)

      throw new Error(`Invalid file type: .${extension}. Only PDF, DOC, and DOCX files are allowed`)

    }



    const maxSize = 10 * 1024 * 1024 // 10MB

    if (file.size > maxSize) {

      throw new Error('File size must be less than 10MB')

    }



    // STEP 1: Create unique filename with job ID structure and proper extension

    const timestamp = Date.now()

    const fileExtension = getFileExtension(file.name) || 'pdf'

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')

    const uniqueFileName = `job_${jobId}/job_document_${timestamp}_${sanitizedFileName}`

    

    console.log('=== STEP 1: UPLOADING JOB DOCUMENT ===')

    console.log('Uploading job document to path:', uniqueFileName)



    // STEP 2: Upload file to storage with proper content type

    const { data: uploadData, error: uploadError } = await supabase.storage

      .from('job-pdfs')

      .upload(uniqueFileName, file, {

        contentType: getContentType(file),

        cacheControl: '0'

      })



    if (uploadError) {

      console.error('Job document storage upload error:', uploadError)

      throw new Error(`Failed to upload to storage: ${uploadError.message}`)

    }



    console.log('Job document uploaded to storage successfully:', uploadData)



    // STEP 3: Generate signed URL

    console.log('=== STEP 3: GENERATING SIGNED URL ===')

    const { data: signedUrlData, error: urlError } = await supabase.storage

      .from('job-pdfs')

      .createSignedUrl(uniqueFileName, 60 * 60 * 24 * 365) // 1 year expiry



    let finalUrl: string



    if (urlError) {

      console.error('URL generation error:', urlError)

      // Fall back to public URL

      const { data: publicUrlData } = supabase.storage

        .from('job-pdfs')

        .getPublicUrl(uniqueFileName)

      

      console.log('Using public URL fallback:', publicUrlData.publicUrl)

      finalUrl = publicUrlData.publicUrl

    } else {

      console.log('Generated signed URL:', signedUrlData.signedUrl)

      finalUrl = signedUrlData.signedUrl

    }



    // STEP 4: Store document info in job_pdfs table

    console.log('=== STEP 4: STORING DOCUMENT INFO IN DATABASE ===')

    const { data: pdfRecord, error: dbError } = await supabase

      .from('job_pdfs')

      .insert({

        job_id: jobId,

        file_name: file.name,

        job_pdf_url: finalUrl,

        file_size: file.size,

        created_at: new Date().toISOString(),

        updated_at: new Date().toISOString()

      })

      .select()



    if (dbError) {

      console.error('Job document database error:', dbError)

      // Cleanup: delete the uploaded file since database insert failed

      await supabase.storage

        .from('job-pdfs')

        .remove([uniqueFileName])

      throw new Error(`Failed to save document info: ${dbError.message}`)

    }



    console.log('Job document record created successfully:', pdfRecord)

    console.log('=== JOB DOCUMENT UPLOAD COMPLETE ===')

    

    return {

      success: true,

      url: finalUrl,

      fileName: file.name,

      pdfRecord: pdfRecord[0]

    }



  } catch (error) {

    console.error('Error in uploadJobPdf:', error)

    throw error

  }

}







export const getJobs = async () => {

  console.log('Fetching jobs from database...')

  

  // First sync the application counts to ensure accuracy

  await syncAllJobApplicationCounts()

  

  const { data, error } = await supabase

    .from('jobs')

    .select('*')

    .order('created_at', { ascending: false })



  console.log('Jobs query result:', { data, error })

  

  if (error) {

    console.error('Database error:', error)

    throw error

  }

  return data

}



export const testConnection = async () => {

  try {

    console.log('Testing database connection...')

    const { data, error } = await supabase

      .from('jobs')

      .select('id')

      .limit(1)

    

    console.log('Connection test result:', { data, error })

    return { success: !error, data, error }

  } catch (err) {

    console.error('Connection test failed:', err)

    return { success: false, error: err }

  }

}



export const getRecommendedJobs = async () => {

  try {

    console.log('Getting recommended jobs...')

    const user = await getCurrentUser()

    console.log('Current user:', user)

    

    if (!user) {

      console.log('No user authenticated, returning active jobs only')

      // For non-authenticated users, only show active jobs

      const { data: activeJobs, error: jobsError } = await supabase

        .from('jobs')

        .select('*')

        .eq('status', 'active')  // Only get active jobs

        .order('created_at', { ascending: false })



      if (jobsError) {

        console.error('Error fetching active jobs:', jobsError)

        throw jobsError

      }



      return activeJobs || []

    }



    console.log('Fetching jobs for authenticated user:', user.id)

    

    // Sync application counts first

    await syncAllJobApplicationCounts()

    

    // Get only active jobs

    const { data: allActiveJobs, error: jobsError } = await supabase

      .from('jobs')

      .select('*')

      .eq('status', 'active')  // Only get active jobs

      .order('created_at', { ascending: false })



    if (jobsError) {

      console.error('Error fetching active jobs:', jobsError)

      throw jobsError

    }



    console.log('Active jobs fetched:', allActiveJobs?.length)



    // Get user's applications

    const { data: applications, error: applicationsError } = await supabase

      .from('job_applications')

      .select('job_id')

      .eq('user_id', user.id)



    if (applicationsError) {

      console.error('Error fetching applications:', applicationsError)

      console.log('Falling back to returning all active jobs due to applications error')

      return allActiveJobs || []

    }



    console.log('User applications:', applications?.length)



    // Filter out applied jobs from active jobs

    const appliedJobIds = new Set(applications?.map(app => app.job_id) || [])

    const recommendedJobs = allActiveJobs?.filter(job => !appliedJobIds.has(job.id)) || []

    

    console.log('Recommended jobs after filtering:', recommendedJobs.length)

    return recommendedJobs



  } catch (error) {

    console.error('Error in getRecommendedJobs:', error)

    throw error

  }

}



export const getAppliedJobs = async () => {

  try {

    console.log('Getting applied jobs...')

    const user = await getCurrentUser()

    if (!user) {

      console.log('No user authenticated, returning empty array')

      return []

    }



    console.log('Fetching applied jobs for user:', user.id)



    // Get user's applications with job details

    const { data, error } = await supabase

      .from('job_applications')

      .select(`

        applied_at,

        status,

        hireability_percentage,

        experience,

        skills,

        education,

        total_score,

        remarks,

        acceptance,

        jobs (

          id,

          title,

          detailed_description,

          criteria,

          status,

          applications_count,

          company_name,

          salary_range,

          created_at,

          updated_at

        )

      `)

      .eq('user_id', user.id)

      .order('applied_at', { ascending: false })



    if (error) {

      console.error('Error fetching applied jobs:', error)

      return []

    }



    console.log('Applied jobs raw data:', data?.length)



    // Transform the data to match our expected structure

    const appliedJobs = data?.map(application => ({

      ...application.jobs,

      job_applications: [{

        applied_at: application.applied_at,

        status: application.status,

        hireability_percentage: application.hireability_percentage,

        experience: application.experience,

        skills: application.skills,

        education: application.education,

        total_score: application.total_score,

        remarks: application.remarks,

        acceptance: application.acceptance

      }]

    })).filter(job => job.id) || []



    console.log('Applied jobs transformed:', appliedJobs.length)

    return appliedJobs



  } catch (error) {

    console.error('Error in getAppliedJobs:', error)

    return []

  }

}



export const hasUserApplied = async (jobId: number) => {

  try {

    const user = await getCurrentUser()

    if (!user) return false



    const { data, error } = await supabase

      .from('job_applications')

      .select('id')

      .eq('user_id', user.id)

      .eq('job_id', jobId)

      .maybeSingle()



    if (error) {

      console.error('Error checking if user applied:', error)

      return false

    }

    

    return !!data

  } catch (error) {

    console.error('Error in hasUserApplied:', error)

    return false

  }

}



// SIMPLIFIED Apply to a job function - database trigger handles all score calculations

export const applyToJob = async (jobId: number) => {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('You must be logged in to apply for jobs')
    }

    console.log('=== APPLYING TO JOB ===')
    console.log('User ID:', user.id)
    console.log('Job ID:', jobId)

    // Check if user has uploaded a resume
    console.log('Checking if user has resume...')
    const resumeUrl = await getResumeUrl(user.id)
    if (!resumeUrl) {
      throw new Error('Please upload your resume before applying to jobs')
    }
    console.log('Resume found:', resumeUrl ? 'Yes' : 'No')

    // Check if already applied
    console.log('Checking if user already applied...')
    const alreadyApplied = await hasUserApplied(jobId)
    if (alreadyApplied) {
      throw new Error('You have already applied to this job')
    }
    console.log('Already applied:', alreadyApplied)

    // Simple insertion with just the required fields
    // Scores will be added later by the Python processing
    console.log('Inserting application record...')
    const { data: insertedData, error: applicationError } = await supabase
      .from('job_applications')
      .insert({
        user_id: user.id,
        job_id: jobId,
        applied_at: new Date().toISOString(),
        status: 'pending'
        // acceptance will default to 'pending' if not specified
        // scores will default to 0 if not specified
      })
      .select('*')

    if (applicationError) {
      console.error('Error inserting application:', applicationError)
      
      // Handle duplicate key error specifically
      if (applicationError.code === '23505') {
        throw new Error('You have already applied to this job')
      }
      
      throw new Error(`Failed to submit application: ${applicationError.message}`)
    }

    console.log('Application submitted successfully:', insertedData)

    // Update job applications count
    console.log('Updating job applications count...')
    try {
      await updateJobApplicationCount(jobId)
    } catch (countError) {
      console.error('Error updating job count (non-critical):', countError)
      // Don't throw error here as the application was successful
    }

    console.log('=== APPLICATION SUBMISSION COMPLETE ===')
    return insertedData[0]

  } catch (error) {
    console.error('Error in applyToJob:', error)
    throw error
  }
}



export const getJobById = async (jobId: number) => {

  const { data, error } = await supabase

    .from('jobs')

    .select('*')

    .eq('id', jobId)

    .single()



  if (error) throw error

  return data

}

export const getApplicationStatus = async (userId: string, jobId: number) => {
  try {
    console.log('Getting application status for user:', userId, 'job:', jobId)
    
    const { data, error } = await supabase
      .from('job_applications')
      .select('*')
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No application found
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error getting application status:', error)
    return null
  }
}

export const waitForScoreProcessing = async (userId: string, jobId: number, maxWaitTime: number = 300000) => {
  const startTime = Date.now()
  const pollInterval = 5000 // Check every 5 seconds
  
  console.log('Waiting for score processing to complete...')
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const application = await getApplicationStatus(userId, jobId)
      
      if (application && application.total_score > 0) {
        console.log('Score processing complete:', application.total_score)
        return application
      }
      
      console.log('Scores not ready yet, waiting...')
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      
    } catch (error) {
      console.error('Error while waiting for scores:', error)
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }
  
  console.log('Score processing timeout reached')
  return null
}

// Get application details for a specific user and job - updated version with acceptance field

export const getApplicationDetails = async (userId: string, jobId: number) => {

  try {

    const { data, error } = await supabase

      .from('job_applications')

      .select('applied_at, status, hireability_percentage, experience, skills, education, total_score, remarks, acceptance')

      .eq('user_id', userId)

      .eq('job_id', jobId)

      .single()



    if (error) {

      if (error.code === 'PGRST116') {

        // No application found

        return null

      }

      throw error

    }



    return data

  } catch (error) {

    console.error('Error getting application details:', error)

    return null

  }

}



// Get tips from user's rejected applications

export const getUserTipsForJob = async (jobId?: number) => {

  try {

    const user = await getCurrentUser()

    if (!user) {

      throw new Error('You must be logged in to view tips')

    }



    let query = supabase

      .from('job_applications')

      .select('remarks')

      .eq('user_id', user.id)

      .eq('acceptance', 'rejected')

      .not('remarks', 'is', null)

      .order('applied_at', { ascending: false })



    // If jobId is provided, filter by that specific job

    if (jobId) {

      query = query.eq('job_id', jobId)

    }



    const { data, error } = await query



    if (error) {

      console.error('Error fetching tips:', error)

      throw error

    }



    // Extract tips from remarks - assuming tips are separated by periods or similar

    const tips: string[] = []

    data?.forEach(application => {

      if (application.remarks) {

        // Split remarks by common delimiters and filter out empty strings

        const tipItems = application.remarks

          .split(/[.!?]/)

          .map(tip => tip.trim())

          .filter(tip => tip.length > 0)

        

        tips.push(...tipItems)

      }

    })



    return tips

  } catch (error) {

    console.error('Error in getUserTipsForJob:', error)

    throw error

  }

}



// Keep the original function for backward compatibility

export const getUserTips = async () => {

  return getUserTipsForJob() // Call the new function without jobId

}