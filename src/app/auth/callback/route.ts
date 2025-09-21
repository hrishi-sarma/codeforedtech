import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    try {
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code)
      
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('Error getting user:', userError)
        return NextResponse.redirect(`${requestUrl.origin}/?error=auth_error`)
      }

      // Check user role from user_profiles table
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Error getting user profile:', profileError)
        // If there's an error getting profile, default to regular user
        return NextResponse.redirect(`${requestUrl.origin}/Home`)
      }

      // Redirect based on user role
      const userRole = profile?.role || 'user'
      
      if (userRole === 'admin') {
        return NextResponse.redirect(`${requestUrl.origin}/Admindash`)
      } else {
        return NextResponse.redirect(`${requestUrl.origin}/Home`)
      }
      
    } catch (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`${requestUrl.origin}/?error=auth_callback_error`)
    }
  }

  // If no code, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/`)
}