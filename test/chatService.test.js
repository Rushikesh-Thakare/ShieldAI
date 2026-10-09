import assert from 'node:assert/strict'
import { test } from 'node:test'
import { answerWithChatProvider } from '../services/chatService.js'
import { answerWithGroq } from '../services/groqService.js'

test('Groq chat uses the configured model and returns its message', async () => {
  const originalKey = process.env.GROQ_API_KEY
  const originalModel = process.env.GROQ_MODEL
  const originalFetch = globalThis.fetch
  process.env.GROQ_API_KEY = 'test-key'
  process.env.GROQ_MODEL = 'test-model'
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions')
    assert.equal(options.headers.Authorization, 'Bearer test-key')
    const body = JSON.parse(options.body)
    assert.equal(body.model, 'test-model')
    assert.match(body.messages[1].content, /How do I check a link\?/)
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Verify the domain independently.' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    assert.equal(await answerWithGroq('How do I check a link?'), 'Verify the domain independently.')
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = originalKey
    if (originalModel === undefined) delete process.env.GROQ_MODEL
    else process.env.GROQ_MODEL = originalModel
  }
})

test('Groq chat defaults to an available model when none is selected', async () => {
  const originalKey = process.env.GROQ_API_KEY
  const originalModel = process.env.GROQ_MODEL
  const originalFetch = globalThis.fetch
  process.env.GROQ_API_KEY = 'test-key'
  delete process.env.GROQ_MODEL
  globalThis.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).model, 'qwen/qwen3.8-27b')
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Check independently.' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    assert.equal(await answerWithGroq('How should I check?'), 'Check independently.')
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = originalKey
    if (originalModel === undefined) delete process.env.GROQ_MODEL
    else process.env.GROQ_MODEL = originalModel
  }
})

test('chat falls back with explicit setup guidance when no provider is configured', async () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY
  const originalGroqKey = process.env.GROQ_API_KEY
  delete process.env.GEMINI_API_KEY
  delete process.env.GROQ_API_KEY

  try {
    assert.deepEqual(await answerWithChatProvider('Is this message suspicious?', '', 'groq'), {
      answer: 'I could not reach an AI service just now. Do not open suspicious links or share passwords or one-time codes. Verify requests using the organization’s official app or a phone number you already trust.',
      provider: 'safe_fallback',
      warning: 'Configure GEMINI_API_KEY or GROQ_API_KEY on the server to enable AI chat.',
    })
  } finally {
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = originalGeminiKey
    if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = originalGroqKey
  }
})
