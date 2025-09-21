import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get request data
    const { fileName, fileSize } = await request.json()

    // Create placeholder job that AI will update later
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        title: `Processing: ${fileName.replace('.pdf', '')}`,
        detailed_description: 'AI is processing the job description from the uploaded PDF...',
        criteria: 'AI is extracting job criteria...',
        company_name: 'Processing...',
        status: 'processing', // Special status for AI processing
        applications_count: 0,
        salary_range: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()

    if (jobError) {
      console.error('Error creating job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create job placeholder' },
        { status: 500 }
      )
    }

    const newJob = job[0]

    // Here you would typically trigger your AI processing
    // For now, we'll just return the job ID
    // Later you can add code to:
    // 1. Send the PDF to your AI model
    // 2. Extract job details
    // 3. Update the job record with extracted data
    // 4. Change status from 'processing' to 'active'

    return NextResponse.json({
      success: true,
      jobId: newJob.id,
      message: 'Job placeholder created, ready for PDF upload'
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}