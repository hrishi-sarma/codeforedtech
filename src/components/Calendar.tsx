import React, { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore } from 'date-fns'
import { Task } from '@/types'

interface CalendarProps {
  tasks: Task[]
  onDateSelect: (date: Date) => void
  selectedDate: Date
}

const Calendar: React.FC<CalendarProps> = ({ tasks, onDateSelect, selectedDate }) => {
  const [currentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => isSameDay(new Date(task.due_date), date))
  }

  const getIntensityColor = (taskCount: number) => {
    if (taskCount === 0) return 'bg-gray-100'
    if (taskCount === 1) return 'bg-green-100'
    if (taskCount === 2) return 'bg-green-200'
    if (taskCount >= 3) return 'bg-green-400'
    return 'bg-gray-100'
  }

  return (
    <div className="p-4 border-2 border-black rounded-lg bg-white">
      <h3 className="font-bold text-lg mb-4 text-center">
        {format(currentMonth, 'MMMM yyyy')}
      </h3>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-bold p-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayTasks = getTasksForDate(day)
          const taskCount = dayTasks.length
          const isSelected = isSameDay(day, selectedDate)
          const isPast = isBefore(day, new Date()) && !isToday(day)
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={`
                w-8 h-8 text-xs border border-gray-300 transition-all hover:border-black
                ${getIntensityColor(taskCount)}
                ${isSelected ? 'border-2 border-black' : ''}
                ${isToday(day) ? 'ring-2 ring-blue-400' : ''}
                ${isPast ? 'opacity-50' : ''}
              `}
              title={`${format(day, 'MMM d')}: ${taskCount} task${taskCount !== 1 ? 's' : ''}`}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
      
      <div className="mt-4 flex items-center justify-between text-xs">
        <span>Less</span>
        <div className="flex space-x-1">
          <div className="w-3 h-3 bg-gray-100 border border-gray-300"></div>
          <div className="w-3 h-3 bg-green-100 border border-gray-300"></div>
          <div className="w-3 h-3 bg-green-200 border border-gray-300"></div>
          <div className="w-3 h-3 bg-green-400 border border-gray-300"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  )
}

export default Calendar