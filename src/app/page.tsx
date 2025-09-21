'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  getCurrentUser,
  getUserRole
} from '@/lib/supabaseClient'
import { LogIn, Mail, Lock } from 'lucide-react'
import { motion } from 'framer-motion'

const Login: React.FC = () => {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Helper function to check user role and redirect accordingly
  const checkUserRoleAndRedirect = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) return

      const userRole = await getUserRole()
      
      if (userRole === 'admin') {
        router.push('/Admindash')
      } else {
        router.push('/Home')
      }
    } catch (error) {
      console.error('Error checking user role:', error)
      // Default to Home page if there's an error
      router.push('/Home')
    }
  }

  useEffect(() => {
    // Check if user is already logged in and redirect accordingly
    checkUserRoleAndRedirect()
  }, [router])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await signInWithGoogle()
      
      // Note: For OAuth, the redirect happens automatically via the callback
      // The actual role check will happen in the callback handler or on page load
      
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
          // For sign up, switch to sign in mode
          setIsSignUp(false)
          setError('')
          setEmail('')
          setPassword('')
          // Show success message instead of error
          setError('Account created! Please check your email for verification, then sign in.')
        } else {
          setError('Please check your email for verification link')
        }
      } else {
        const { user } = await signInWithEmail(email, password)
        if (user) {
          // Check user role and redirect accordingly
          await checkUserRoleAndRedirect()
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
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      {/* Animated Background */}
      <motion.div
        className="absolute inset-0"
        initial={{ backgroundPosition: '0% 50%' }}
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage: `url('/lightleak.png')`, // replace with your uploaded asset
          backgroundSize: '200% 200%',
          filter: 'blur(40px)',
        }}
      />

      {/* Overlay to enhance blur */}
      <div className="absolute inset-0" />

      {/* Main Content */}
      <div className="flex flex-1 relative z-10">
        
        {/* Left - Sign in/Sign up */}
        <div className="w-2/5 flex items-center justify-center p-8">
          <div className="w-full max-w-md p-8 rounded-2xl  
                          bg-white/30 backdrop-blur-2xl">
            <h2 className="text-3xl font-bold mb-6 text-center">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h2>
            {error && (
              <div className={`mb-4 p-3 border-2 rounded-lg ${
                error.includes('Account created') 
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-red-300 bg-red-50 text-red-700'
              }`}>
                {error}
              </div>
            )}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-black rounded-lg bg-white/50 focus:outline-none"
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
                  className="w-full pl-12 pr-4 py-3 border-2 border-black rounded-lg bg-white/50 focus:outline-none"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full p-3 border-2 border-black rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </button>
            </form>

            <div className="my-4 text-center text-sm">or</div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full p-3 border-2 border-black rounded-lg bg-white/60 hover:bg-gray-100 flex items-center justify-center space-x-3 disabled:opacity-50"
            >
              <LogIn size={20} />
              <span className="font-bold">Sign in with Google</span>
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                  setEmail('')
                  setPassword('')
                }}
                className="text-sm text-gray-700 hover:text-black underline"
                disabled={loading}
              >
                {isSignUp 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </div>
        </div>

        {/* Right - Resume Checker */}
        <div className="w-3/5 flex items-center justify-center p-8">
          <div className="w-full h-full p-8 flex flex-col">
            <h1 className="text-6xl font-bold text-white text-center mb-8">Resume Checker</h1>
            <div className="flex-1 p-6 rounded-xl  bg-white/40 backdrop-blur-xl">
              <h2 className="text-xl font-bold mb-4">Description Title</h2>
              <p className="text-gray-800">Random description blah blah blah</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t-2 bg-white/30 backdrop-blur-2xl text-center relative z-10">
        Footer Component
      </div>
    </div>
  )
}

export default Login