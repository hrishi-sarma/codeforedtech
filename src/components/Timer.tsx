import React, { useState, useEffect } from 'react'
import { Play, Pause, Square } from 'lucide-react'

const Timer: React.FC = () => {
  const [time, setTime] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (isRunning) {
      interval = setInterval(() => {
        setTime(time => time + 1)
      }, 1000)
    } else if (!isRunning && time !== 0) {
      if (interval) clearInterval(interval)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, time])

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStart = () => setIsRunning(!isRunning)
  const handleReset = () => {
    setTime(0)
    setIsRunning(false)
  }

  return (
    <div className="p-4 border-2 border-black rounded-lg bg-white text-center">
      <h3 className="font-bold mb-4">Timer</h3>
      <div className="text-2xl font-mono mb-4">{formatTime(time)}</div>
      <div className="flex justify-center space-x-2">
        <button
          onClick={handleStart}
          className="p-2 border-2 border-black rounded hover:bg-gray-100 transition-colors"
        >
          {isRunning ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={handleReset}
          className="p-2 border-2 border-black rounded hover:bg-gray-100 transition-colors"
        >
          <Square size={16} />
        </button>
      </div>
    </div>
  )
}

export default Timer