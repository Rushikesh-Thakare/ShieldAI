import React, { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Sparkles, Shield, Send, Terminal, ArrowUpRight, LockKeyhole,
  Trash2, Copy
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { ChatMessage } from '../types'

export const AssistantPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const { toast } = useToast()

  const [inputMessage, setInputMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [threatContext, setThreatContext] = useState(
    searchParams.get('context') || ''
  )

  useEffect(() => {
    const ctx = searchParams.get('context')
    if (ctx) {
      setThreatContext(ctx)
    }
  }, [searchParams])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      from: 'shield',
      text:
        'Hello! I am your AI Security Copilot powered by Google Gemini 2.0 Flash. I specialize in explaining cyber attack vectors, identifying social engineering traps, and guiding incident recovery. How can I assist your defense today?',
      provider: 'Gemini 2.0 Flash',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const chatFeedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight
    }
  }, [messages, chatLoading])

  const suggestedQuestions = [
    'Why was this banking link flagged as dangerous?',
    'Is my account compromised if I closed the tab immediately?',
    'How do scammers bypass SMS 2-Factor Authentication?',
    'What steps should I take after receiving an executive wire request?',
  ]

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim()
    if (!text || chatLoading) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      from: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputMessage('')
    setChatLoading(true)

    // Format chat history for backend
    const historyPayload = messages
      .filter((m) => m.id !== 'welcome-msg')
      .map((m) => ({
        role: m.from === 'user' ? 'user' : 'model',
        text: m.text,
      }))

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          question: text,
          history: historyPayload,
          threatContext,
          context: threatContext,
        }),
      })

      if (!res.ok) {
        throw new Error('Chat service unavailable')
      }

      const data = await res.json()
      const answerText = data.reply || data.explanation || data.answer || data.text

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        from: 'shield',
        text: answerText,
        provider: data.source === 'gemini' ? 'Gemini 2.0 Flash' : data.provider || 'Shield AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, botMsg])
    } catch {
      // Local defensive response fallback
      const fallbackAnswers: Record<string, string> = {
        'Why was this banking link flagged as dangerous?':
          'The link was flagged because its domain infrastructure was registered recently, contains typosquatted brand indicators, and uses an unverified SSL certificate to harvest online banking credentials.',
        'Is my account compromised if I closed the tab immediately?':
          'You are safe if you did not type in passwords, card details, or One-Time Passwords (OTPs). Modern browsers sandbox tabs, so simply viewing a page before it connects does not compromise accounts unless malicious executables were downloaded.',
        'How do scammers bypass SMS 2-Factor Authentication?':
          'Scammers use reverse proxies or live human caller spoofing to trick victims into entering their OTP on a lookalike portal in real time. Never share one-time passcodes over the phone or on unverified URLs.',
        'What steps should I take after receiving an executive wire request?':
          'Never remit funds or buy gift cards based solely on an email. Verify the request through a secondary out-of-band channel (such as a voice call or internal Slack/Teams) using verified contact numbers.',
      }

      const fallbackText =
        fallbackAnswers[text] ||
        `Based on Shield AI security heuristics: Do not submit confidential passwords or payment details. If you suspect an account compromise, change your credentials from the official application and activate multi-factor authentication.`

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-fallback-${Date.now()}`,
          from: 'shield',
          text: fallbackText,
          provider: 'Shield Defense Engine',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const handleCopyMessage = (text: string) => {
    void navigator.clipboard.writeText(text)
    toast('Copied response to clipboard!')
  }

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-msg',
        from: 'shield',
        text:
          'Chat session reset. What other security threat or forensic incident would you like to explore?',
        provider: 'Gemini 2.0 Flash',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    toast('Conversation cleared.')
  }

  return (
    <div className="assistant-container">
      {/* Copilot Header */}
      <div className="assistant-header">
        <div className="assistant-title-wrap">
          <div className="assistant-badge">
            <Sparkles size={14} className="text-emerald" />
            <span>GEMINI 2.0 FLASH POWERED</span>
          </div>
          <h1>AI Security Copilot<span className="period">.</span></h1>
          <p>
            Interactive advisory on threat attribution, credential compromise mitigation, and attack anatomy.
          </p>
        </div>

        <button
          type="button"
          className="button button-outline clear-chat-btn"
          onClick={handleClearHistory}
        >
          <Trash2 size={14} />
          <span>Reset Session</span>
        </button>
      </div>

      {/* Threat Context Ribbon */}
      <div className="threat-context-ribbon">
        <div className="context-label">
          <Terminal size={14} className="text-sky" />
          <span>Active Forensic Context:</span>
        </div>
        <input
          type="text"
          className="context-input"
          value={threatContext}
          onChange={(e) => setThreatContext(e.target.value)}
          placeholder="Optional: Enter domain, URL, or forensic context to focus the copilot..."
        />
      </div>

      {/* Main Chat Card */}
      <div className="assistant-chat-card">
        {/* Chat Feed */}
        <div className="chat-feed-box" ref={chatFeedRef}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`chat-bubble-row ${m.from === 'user' ? 'user-row' : 'shield-row'}`}
            >
              {m.from === 'shield' && (
                <div className="shield-avatar-icon">
                  <Shield size={16} />
                </div>
              )}

              <div className="chat-bubble">
                <div className="bubble-header">
                  <span className="bubble-sender">
                    {m.from === 'user' ? 'You' : 'Shield AI'}
                  </span>
                  {m.provider && (
                    <span className="bubble-provider-pill">{m.provider}</span>
                  )}
                  {m.timestamp && <span className="bubble-time">{m.timestamp}</span>}
                </div>

                <div className="bubble-body">{m.text}</div>

                {m.from === 'shield' && (
                  <button
                    type="button"
                    className="bubble-copy-btn"
                    onClick={() => handleCopyMessage(m.text)}
                    title="Copy message"
                  >
                    <Copy size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="chat-bubble-row shield-row">
              <div className="shield-avatar-icon">
                <Shield size={16} />
              </div>
              <div className="chat-bubble loading-bubble">
                <div className="bubble-header">
                  <span className="bubble-sender">Shield AI</span>
                  <span className="bubble-provider-pill">Gemini Thinking...</span>
                </div>
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Question Chips */}
        <div className="suggested-questions-row">
          <span className="suggested-label">Ask quick questions:</span>
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="suggested-chip"
              onClick={() => void handleSendMessage(q)}
              disabled={chatLoading}
            >
              <span>{q}</span>
              <ArrowUpRight size={12} />
            </button>
          ))}
        </div>

        {/* Input Bar Form */}
        <form
          className="assistant-input-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSendMessage()
          }}
        >
          <input
            type="text"
            className="chat-text-input"
            placeholder={
              chatLoading
                ? 'Synthesizing defensive guidance...'
                : 'Ask anything about a link, threat vector, or incident recovery steps...'
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={chatLoading}
          />

          <button
            type="submit"
            className="button button-primary chat-send-btn"
            disabled={chatLoading || !inputMessage.trim()}
          >
            <Send size={15} />
            <span>Send</span>
          </button>
        </form>

        <div className="assistant-privacy-footer">
          <LockKeyhole size={12} />
          <span>Powered by Google Gemini 2.0 Flash with zero external telemetry logging.</span>
        </div>
      </div>
    </div>
  )
}
