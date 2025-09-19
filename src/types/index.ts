export interface Task {
  id: string
  title: string
  description?: string
  due_date: string
  completed: boolean
  type: 'task' | 'meeting'
  user_id: string
  created_at: string
}

export interface Note {
  id: string
  title: string
  content: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface Update {
  id: string
  title: string
  description: string
  created_at: string
  read: boolean
  user_id?: string
}

export interface Class {
  id: string
  name: string
  video_url?: string
  summary: string
  assignments: Assignment[]
}

export interface Assignment {
  id: string
  title: string
  questions: string[]
  class_id: string
}