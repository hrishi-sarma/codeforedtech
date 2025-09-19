'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, isToday } from 'date-fns'
import { Calendar, Plus } from 'lucide-react'
import CalendarComponent from '@/components/Calendar'
import TimerComponent from '@/components/Timer'
import { Task, Note, Update } from '@/types'
import {
  getNotes,
  getUpdates,
  createNote,
  getCurrentUser,
  markUpdateAsRead,
} from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

const Dashboard: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeTab = searchParams.get('tab') || 'calendar'

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [updates, setUpdates] = useState<Update[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [newNote, setNewNote] = useState({ title: '', content: '' })
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)

  useEffect(() => {
    const initializeData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser) {
          setUser(currentUser)

          // Sample tasks
          const sampleTasks: Task[] = [
            {
              id: '1',
              user_id: currentUser.id,
              title: 'Mathematics Assignment 1',
              description:
                'Complete algebra problems: What is blah blah, How is blah blah formed',
              due_date: new Date().toISOString().split('T')[0],
              completed: false,
              type: 'task',
              created_at: new Date().toISOString(),
            },
            {
              id: '2',
              user_id: currentUser.id,
              title: 'Mathematics Assignment 2',
              description:
                'Solve for x: 2x + 5 = 13, What is the area of a circle?',
              due_date: new Date(Date.now() + 86400000)
                .toISOString()
                .split('T')[0],
              completed: false,
              type: 'task',
              created_at: new Date().toISOString(),
            },
            {
              id: '3',
              user_id: currentUser.id,
              title: 'Physics Assignment 1',
              description:
                "Define Newton's First Law, Calculate velocity from distance and time",
              due_date: new Date(Date.now() + 172800000)
                .toISOString()
                .split('T')[0],
              completed: false,
              type: 'task',
              created_at: new Date().toISOString(),
            },
            {
              id: '4',
              user_id: currentUser.id,
              title: 'Chemistry Assignment 1',
              description: 'What is an atom?, Explain covalent bonding',
              due_date: new Date(Date.now() + 259200000)
                .toISOString()
                .split('T')[0],
              completed: false,
              type: 'task',
              created_at: new Date().toISOString(),
            },
            {
              id: '5',
              user_id: currentUser.id,
              title: 'Join Team Meeting',
              description: 'Weekly team sync and project updates',
              due_date: new Date().toISOString().split('T')[0],
              completed: false,
              type: 'meeting',
              created_at: new Date().toISOString(),
            },
          ]

          const [notesData, updatesData] = await Promise.all([
            getNotes(currentUser.id),
            getUpdates(currentUser.id),
          ])

          setTasks(sampleTasks)
        //   setNotes(notesData || [])
        //   setUpdates(updatesData || [])
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeData()

    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const filteredTasks = tasks.filter((task) => {
    const taskDate = new Date(task.due_date)
    return taskDate.toDateString() === selectedDate.toDateString()
  })

  const handleTaskAction = (taskId: string, action: string) => {
    if (action === 'join') {
      router.push('/Meet')
    } else if (action === 'go') {
      router.push('/Classes')
    }
    console.log(`${action} task ${taskId}`)
  }

  const handleAddNote = async () => {
    if (newNote.title.trim() && newNote.content.trim() && user) {
      try {
        const note = await createNote(user.id, newNote.title, newNote.content)
        // setNotes((prev) => [note, ...prev])
        setNewNote({ title: '', content: '' })
        setIsAddingNote(false)
      } catch (error) {
        console.error('Error creating note:', error)
        alert('Failed to create note. Please try again.')
      }
    }
  }

  const handleUpdateRead = async (updateId: string) => {
    try {
      await markUpdateAsRead(updateId)
      setUpdates((prev) =>
        prev.map((update) =>
          update.id === updateId ? { ...update, read: true } : update
        )
      )
    } catch (error) {
      console.error('Error marking update as read:', error)
    }
  }

  const unreadUpdatesCount = updates.filter((update) => !update.read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-mono">Loading your dashboard...</div>
      </div>
    )
  }

  const setActiveTab = (tab: string) => {
    const newSearchParams = new URLSearchParams(searchParams?.toString() || '')
    newSearchParams.set('tab', tab)
    router.push(`/Dashboard?${newSearchParams.toString()}`)
  }

  const renderRightPanel = () => {
    switch (activeTab) {
      case 'updates':
        return (
          <div className="p-4 h-full overflow-y-auto">
            <h2 className="font-bold text-xl mb-4">Updates</h2>
            <div className="space-y-3">
              {updates.map((update) => (
                <div
                  key={update.id}
                  className={`p-3 border-2 border-black rounded-lg cursor-pointer transition-colors ${
                    update.read ? 'bg-gray-50' : 'bg-white'
                  }`}
                  onClick={() =>
                    !update.read ? handleUpdateRead(update.id) : undefined
                  }
                >
                  <div className="flex justify-between items-start">
                    <h3
                      className={`font-bold mb-1 ${
                        !update.read ? 'text-black' : 'text-gray-600'
                      }`}
                    >
                      {update.title}
                    </h3>
                    {!update.read && (
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{update.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {format(new Date(update.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )

      case 'notes':
        return (
          <div className="p-4 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl">Notes</h2>
              <button
                onClick={() => setIsAddingNote(true)}
                className="px-3 py-1 border-2 border-black rounded bg-white hover:bg-gray-100 flex items-center space-x-1"
              >
                <Plus size={16} />
                <span>Add Note</span>
              </button>
            </div>

            {isAddingNote && (
              <div className="mb-4 p-4 border-2 border-black rounded-lg bg-gray-50">
                <input
                  type="text"
                  placeholder="Note title..."
                  value={newNote.title}
                  onChange={(e) =>
                    setNewNote((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full p-2 border border-black rounded mb-2"
                />
                <textarea
                  placeholder="Write your note here..."
                  value={newNote.content}
                  onChange={(e) =>
                    setNewNote((prev) => ({ ...prev, content: e.target.value }))
                  }
                  rows={4}
                  className="w-full p-2 border border-black rounded mb-2 resize-none"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddNote}
                    className="px-3 py-1 border-2 border-black rounded bg-black text-white hover:bg-gray-800"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingNote(false)
                      setNewNote({ title: '', content: '' })
                    }}
                    className="px-3 py-1 border-2 border-black rounded bg-white hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {selectedNote ? (
              <div className="border-2 border-black rounded-lg bg-white p-4">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg">{selectedNote.title}</h3>
                  <button
                    onClick={() => setSelectedNote(null)}
                    className="text-gray-500 hover:text-black text-xl"
                  >
                    ×
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-sm">
                  {selectedNote.content}
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  Created:{' '}
                  {format(
                    new Date(selectedNote.created_at),
                    'MMM d, yyyy h:mm a'
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="p-3 border-2 border-black rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                  >
                    <h3 className="font-bold mb-1">{note.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {note.content.substring(0, 100)}
                      {note.content.length > 100 ? '...' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {format(new Date(note.updated_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      default:
        return (
          <div className="p-4 space-y-4">
            {/* Current Time */}
            <div className="text-center p-4 border-2 border-black rounded-lg bg-white">
              <div className="text-sm text-gray-600 mb-1">
                {format(currentTime, 'do MMMM')}
              </div>
              <div className="text-3xl font-bold font-mono">
                {format(currentTime, 'h:mm a')}
              </div>
            </div>

            {/* Timer */}
            <TimerComponent />

            {/* Calendar */}
            <CalendarComponent
              tasks={tasks}
              onDateSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
          </div>
        )
    }
  }

  return (
    <div
      className="flex h-screen bg-gray-50"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      {/* Left Panel - Tasks */}
      <div className="flex-1 p-4 overflow-y-auto border-r-2 border-black">
        <div className="space-y-4">
          <h2 className="font-bold text-xl mb-4">
            Tasks for {format(selectedDate, 'MMMM d, yyyy')}
            {isToday(selectedDate) && ' (Today)'}
          </h2>

          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar size={48} className="mx-auto mb-4" />
              <p>No tasks for this day</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 border-2 border-black rounded-lg bg-white flex justify-between items-center"
              >
                <div className="flex-1">
                  <h3 className="font-bold">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {task.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() =>
                    handleTaskAction(
                      task.id,
                      task.type === 'meeting' ? 'join' : 'go'
                    )
                  }
                  className="px-4 py-2 border-2 border-black rounded bg-white hover:bg-gray-100 transition-colors"
                >
                  {task.type === 'meeting' ? 'Join' : 'Go'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-80 bg-white border-l-2 border-black flex flex-col">
        {/* Tab Navigation */}
        <div className="flex border-b-2 border-black">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 px-3 py-2 text-sm transition-colors ${
              activeTab === 'calendar'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('updates')}
            className={`flex-1 px-3 py-2 text-sm transition-colors relative ${
              activeTab === 'updates'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            Updates
            {unreadUpdatesCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadUpdatesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 px-3 py-2 text-sm transition-colors ${
              activeTab === 'notes'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            Notes
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">{renderRightPanel()}</div>
      </div>
    </div>
  )
}

export default Dashboard
