import React, { useState, useEffect } from 'react'
import { Search, MessageSquare, X } from 'lucide-react'
import Navbar from './Navbar'

interface LayoutProps {
  children: React.ReactNode
}

interface ChatMessage {
  id: string
  message: string
  isUser: boolean
  timestamp: Date
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      message: searchQuery,
      isUser: true,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        message: `I understand you're asking about "${searchQuery}". As your AI assistant, I can help you with tasks, scheduling, note-taking, and class materials. What would you like to know more about?`,
        isUser: false,
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, aiResponse])
      setIsLoading(false)
    }, 1500)

    setSearchQuery('')
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Courier New, monospace' }}>
      <Navbar />
      
      {/* Fixed Search/Chatbot - Bottom positioned */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-4xl">
        <form onSubmit={handleSearch} className="relative">
          <div className={`transition-all duration-300 ${
            isSearchExpanded ? 'bg-white border-2 border-black rounded-lg shadow-lg' : ''
          }`}>
            {isSearchExpanded && chatMessages.length > 0 && (
              <div className="p-4 max-h-60 overflow-y-auto border-b-2 border-black mb-2">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`mb-3 ${msg.isUser ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block max-w-xs p-2 rounded ${
                      msg.isUser 
                        ? 'bg-black text-white ml-auto' 
                        : 'bg-gray-100 border border-black'
                    }`}>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="text-left mb-3">
                    <div className="inline-block bg-gray-100 border border-black p-2 rounded">
                      <p className="text-sm">Thinking...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="relative">
              <input
                type="text"
                placeholder="Ask me anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchExpanded(true)}
                className="w-full p-3 pr-12 border-2 border-black rounded-lg bg-white focus:outline-none"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex space-x-2">
                {isSearchExpanded && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchExpanded(false)
                      setChatMessages([])
                      setSearchQuery('')
                    }}
                    className="text-gray-500 hover:text-black"
                  >
                    <X size={20} />
                  </button>
                )}
                <button type="submit" className="text-black hover:text-gray-700">
                  {isSearchExpanded ? <MessageSquare size={20} /> : <Search size={20} />}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <main className="pt-20 pb-20">
        {children}
      </main>
    </div>
  )
}

export default Layout