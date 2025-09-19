'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, BookOpen } from 'lucide-react'
import { supabase, signOut, getCurrentUser } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

const Navbar: React.FC = () => {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const initializeUser = async () => {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    }

    initializeUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
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

  if (!user) return null

  return (
    <nav
      className="fixed top-0 left-0 right-0 bg-white border-b-2 border-black z-40 p-4"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <BookOpen size={24} />
          <span className="font-bold text-lg">EduGo</span>
        </div>

        {/* Nav Links */}
        <div className="flex space-x-4">
          <Link
            href="/Dashboard"
            className={`px-4 py-2 border-2 border-black rounded transition-colors ${
              pathname === '/'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            Home
          </Link>

          <Link
            href="/Classes"
            className={`px-4 py-2 border-2 border-black rounded transition-colors ${
              pathname === '/Classes'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            Classes
          </Link>

          <button
            onClick={handleLogout}
            className="px-4 py-2 border-2 border-black rounded bg-white hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
