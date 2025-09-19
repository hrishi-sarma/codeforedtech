'use client'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// ✅ Create typed Supabase client
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
   🔑 AUTH HELPERS
--------------------------------*/
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
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
      emailRedirectTo: `${window.location.origin}/dashboard`,
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
   👤 USER HELPERS
--------------------------------*/
export const getCurrentUser = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session?.user ?? null
}

/* -----------------------------
   📦 DATABASE HELPERS
--------------------------------*/
export const getUpdates = async (userId: string) => {
  const { data, error } = await supabase
    .from('updates')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const createNote = async (userId: string, title: string, content: string) => {
  const { data, error } = await supabase
    .from('notes')
    .insert([{ user_id: userId, title, content }])
    .select()
    .single()

  if (error) throw error
  return data
}

export const markUpdateAsRead = async (updateId: string) => {
  const { data, error } = await supabase
    .from('updates')
    .update({ read: true })
    .eq('id', updateId)
    .select()
    .single()

  if (error) throw error
  return data
}

export const getTasks = async (userId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true })

  if (error) throw error
  return data
}

export const getNotes = async (userId: string) => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}