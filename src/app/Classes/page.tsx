'use client'

import React, { useState } from 'react'
import { Play, FileText, Clock } from 'lucide-react'

interface Assignment {
  id: string
  title: string
  questions: string[]
}

interface Class {
  id: string
  name: string
  videoUrl?: string
  summary: string
  assignments: Assignment[]
}

const Classes: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null)

  const classes: Class[] = [
    {
      id: '1',
      name: 'Mathematics 101',
      videoUrl: 'https://example.com/video1',
      summary: 'Introduction to basic mathematical concepts including algebra and geometry.',
      assignments: [
        {
          id: 'a1',
          title: 'Assignment 1',
          questions: [
            '1. What is blah blah',
            '2. How is blah blah formed'
          ]
        },
        {
          id: 'a2',
          title: 'Assignment 2', 
          questions: [
            '1. Solve for x: 2x + 5 = 13',
            '2. What is the area of a circle?'
          ]
        }
      ]
    },
    {
      id: '2',
      name: 'Physics 101',
      videoUrl: 'https://example.com/video2',
      summary: 'Fundamentals of physics covering motion, forces, and energy.',
      assignments: [
        {
          id: 'a3',
          title: 'Assignment 1',
          questions: [
            '1. Define Newton\'s First Law',
            '2. Calculate velocity from distance and time'
          ]
        }
      ]
    },
    {
      id: '3',
      name: 'Chemistry 101',
      videoUrl: 'https://example.com/video3',
      summary: 'Basic chemistry principles including atomic structure and chemical bonding.',
      assignments: [
        {
          id: 'a4',
          title: 'Assignment 1',
          questions: [
            '1. What is an atom?',
            '2. Explain covalent bonding'
          ]
        }
      ]
    }
  ]

  if (!selectedClass) {
    return (
      <div className="p-6" style={{ fontFamily: 'Courier New, monospace' }}>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Classes</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map(cls => (
              <div
                key={cls.id}
                onClick={() => setSelectedClass(cls)}
                className="p-6 border-2 border-black rounded-lg bg-white cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="aspect-video bg-gray-100 border border-black rounded mb-4 flex items-center justify-center">
                  <Play size={48} className="text-gray-400" />
                </div>
                <h2 className="font-bold text-xl mb-2">{cls.name}</h2>
                <p className="text-sm text-gray-600 line-clamp-3">{cls.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (activeAssignment) {
    return (
      <div className="p-6" style={{ fontFamily: 'Courier New, monospace' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setActiveAssignment(null)}
              className="px-4 py-2 border-2 border-black rounded bg-white hover:bg-gray-100"
            >
              ← Back to Class
            </button>
            <h1 className="text-2xl font-bold">{activeAssignment.title}</h1>
            <div></div>
          </div>

          <div className="border-2 border-black rounded-lg bg-white p-6">
            <div className="mb-4 flex space-x-2">
              <button className="px-4 py-2 border-2 border-black rounded bg-black text-white">
                Assignment 1
              </button>
              <button className="px-4 py-2 border-2 border-black rounded bg-white hover:bg-gray-100">
                Assignment 2
              </button>
            </div>

            <div className="space-y-4 mb-8">
              {activeAssignment.questions.map((question, index) => (
                <div key={index} className="p-4 border border-black rounded">
                  <p className="font-medium">{question}</p>
                </div>
              ))}
            </div>

            <div className="text-right">
              <button className="px-6 py-3 border-2 border-black rounded bg-black text-white hover:bg-gray-800">
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6" style={{ fontFamily: 'Courier New, monospace' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedClass(null)}
            className="px-4 py-2 border-2 border-black rounded bg-white hover:bg-gray-100"
          >
            ← Back to Classes
          </button>
          <h1 className="text-2xl font-bold">{selectedClass.name}</h1>
          <div></div>
        </div>

        {/* Video and Summary Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="border-2 border-black rounded-lg bg-white p-4">
              <h2 className="font-bold text-xl mb-4 text-center">Recorded Video</h2>
              <div className="aspect-video bg-gray-100 border border-black rounded flex items-center justify-center">
                <div className="text-center">
                  <Play size={64} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">Video content would be here</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-2 border-black rounded-lg bg-white p-4">
            <h2 className="font-bold text-xl mb-4 text-center">Summary</h2>
            <div className="text-sm leading-relaxed">
              <p>{selectedClass.summary}</p>
            </div>
          </div>
        </div>

        {/* Assignments Section */}
        <div className="border-2 border-black rounded-lg bg-white p-6">
          <h2 className="font-bold text-xl mb-6">Assignments</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedClass.assignments.map(assignment => (
              <div
                key={assignment.id}
                onClick={() => setActiveAssignment(assignment)}
                className="p-4 border-2 border-black rounded cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <FileText size={24} />
                  <h3 className="font-bold">{assignment.title}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {assignment.questions.length} question{assignment.questions.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock size={14} className="mr-1" />
                    <span>Due: Next week</span>
                  </div>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    Available
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Classes