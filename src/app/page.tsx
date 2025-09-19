'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  getCurrentUser
} from '@/lib/supabaseClient'
import { LogIn, BookOpen, Mail, Lock } from 'lucide-react'

const Login: React.FC = () => {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) {
        router.push('/Dashboard')
      }
    })
  }, [router])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError('')
      await signInWithGoogle()
      // Redirect handled by Supabase
    } catch (error: Error | unknown) {
      console.error('Login error:', error)
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      if (isSignUp) {
        const { user } = await signUpWithEmail(email, password)
        if (user) {
          router.push('/Dashboard')
        } else {
          setError('Please check your email for verification link')
        }
      } else {
        const { user } = await signInWithEmail(email, password)
        if (user) {
          router.push('/Dashboard')
        }
      }

    } catch (error: unknown) {
      console.error('Auth error:', error)
      setError(
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Authentication failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      <div className="w-full max-w-6xl border-4 border-black rounded-3xl bg-white p-8 flex">
        {/* Left Side */}
        <div className="flex-1 pr-8">
          <div className="flex items-center mb-8">
            <BookOpen size={64} className="mr-4" />
            <h1 className="text-6xl font-bold" style={{ fontFamily: 'Brush Script MT, cursive' }}>
              EduGo
            </h1>
          </div>
          
          <div className="space-y-4 text-lg">
            <p>Your comprehensive learning companion for managing tasks, attending classes, and staying organized.</p>
            <p>Track your progress with our intuitive calendar system.</p>
            <p>Join virtual meetings, take notes, and never miss an assignment with EduGos smart notification system.</p>
          </div>

          <div className="mt-16">
            <div className="border-2 border-black rounded-lg p-4 bg-gray-50">
              <p className="text-center text-sm">© 2025 EduGo - Empowering Education Through Technology</p>
            </div>
          </div>
        </div>

        {/* Right Side - Login */}
        <div className="flex-1 pl-8 border-l-2 border-black">
          <div className="border-2 border-black rounded-lg p-8 h-full flex flex-col justify-center">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-4">
                {isSignUp ? 'Create Account' : 'Welcome to EduGo'}
              </h2>
              <p className="text-gray-600 mb-6">
                {isSignUp 
                  ? 'Sign up to start your learning journey' 
                  : 'Sign in to access your personalized learning dashboard'}
              </p>
              
              {error && (
                <div className="mb-4 p-3 border-2 border-red-300 rounded-lg bg-red-50 text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                {/* Email/Password Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
                    <div className="p-3 border-2 border-yellow-300 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
                      <p className="font-bold">⚠️ Supabase Not Configured</p>
                      <p>Please set up your Supabase credentials in the .env.local file to enable authentication.</p>
                    </div>
                  )}
                  
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-gray-600"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-gray-600"
                      disabled={loading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !process.env.NEXT_PUBLIC_SUPABASE_URL}
                    className="w-full p-4 border-2 border-black rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                  </button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  disabled={loading || !process.env.NEXT_PUBLIC_SUPABASE_URL}
                  className="w-full p-4 border-2 border-black rounded-lg bg-white hover:bg-gray-100 transition-colors flex items-center justify-center space-x-3 disabled:opacity-50"
                >
                  <LogIn size={20} />
                  <span className="font-bold">Sign in with Google</span>
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp)
                      setError('')
                      setEmail('')
                      setPassword('')
                    }}
                    className="text-sm text-gray-600 hover:text-black underline"
                  >
                    {isSignUp 
                      ? 'Already have an account? Sign in' 
                      : "Don't have an account? Sign up"}
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
