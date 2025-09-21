'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, BookOpen, Shield } from 'lucide-react'
import { supabase, signOut, getCurrentUser, checkIfUserIsAdmin } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

const Navbar: React.FC = () => {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
        
        if (currentUser) {
          const adminStatus = await checkIfUserIsAdmin()
          setIsAdmin(adminStatus)
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        console.error('Error initializing user:', error)
        setUser(null)
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    initializeUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          try {
            const adminStatus = await checkIfUserIsAdmin()
            setIsAdmin(adminStatus)
          } catch (error) {
            console.error('Error checking admin status:', error)
            setIsAdmin(false)
          }
        } else {
          setIsAdmin(false)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  if (!user || loading) return null

  return (
    <div
      className="fixed top-6 left-0 right-0 flex justify-between items-center
                 px-8 z-40"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      {/* Left - Logo */}
      <div className="bg-black text-white border-2 border-black rounded-xl px-4 py-2 flex items-center space-x-2 shadow-lg">
        <BookOpen size={20} />
        <span className="font-bold text-lg">EduGo</span>
        {isAdmin && (
          <div className="bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold flex items-center space-x-1">
            <Shield size={12} />
            <span>ADMIN</span>
          </div>
        )}
      </div>

      {/* Right - Nav Links */}
      <div className="bg-black text-white border-2 border-black rounded-l flex space-x-1 shadow-lg">
        <Link
          href="/Home"
          className={`px-4 py-2 rounded transition-colors ${
            pathname === '/Home'
              ? 'bg-white text-black'
              : 'hover:bg-white hover:text-black'
          }`}
        >
          Home
        </Link>
        
        {isAdmin ? (
          <Link
            href="/Admindash"
            className={`px-4 py-2 rounded transition-colors ${
              pathname === '/Admindash' || pathname.startsWith('/AdminJobs')
                ? 'bg-white text-black'
                : 'hover:bg-white hover:text-black'
            }`}
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/Jobs"
            className={`px-4 py-2 rounded transition-colors ${
              pathname === '/Jobs'
                ? 'bg-white text-black'
                : 'hover:bg-white hover:text-black'
            }`}
          >
            Jobs
          </Link>
        )}

        
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded transition-colors hover:bg-white hover:text-black flex items-center space-x-2"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}

export default Navbar