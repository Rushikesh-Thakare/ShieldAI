import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiLimiter, scanLimiter } from './middleware/rateLimiter.js'
import apiRoutes from './routes/apiRoutes.js'
import { logger } from './utils/logger.js'

const app = express()
const port = Number(process.env.PORT) || 3000
const root = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(root, 'dist')
const publicPath = path.join(root, 'public')

app.disable('x-powered-by')
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json({ limit: '11mb' }))
app.use(express.urlencoded({ extended: false, limit: '11mb' }))

// Rate limiting
app.use('/api', apiLimiter.middleware())
app.use('/api/scan', scanLimiter.middleware())
app.use('/api/analyze', scanLimiter.middleware())

// Mount modular API routes
app.use('/api', apiRoutes)

// API 404 fallback
app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }))

// Enterprise SOC Console direct route
app.get(['/sentinel', '/sentinel.html'], (_req, res) => {
  res.sendFile(path.join(publicPath, 'sentinel.html'))
})

// Serve static assets from public folder (sentinel.js, extension, icons)
app.use(express.static(publicPath))

// Serve static assets from Vite build output
app.use(express.static(distPath))

// Single-page application route fallback
app.get(/^(?!\/api).*/, (_req, res, next) => {
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error) {
      res.sendFile(path.join(publicPath, 'sentinel.html'), (err2) => {
        if (err2) next(err2)
      })
    }
  })
})

// Global error handler
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' })
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' })
  }
  logger.error('Unhandled server error', { error: error?.message })
  return res.status(500).json({ error: 'The server could not complete this request.' })
})

if (process.env.VERCEL !== '1' && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = app.listen(port, () => {
    logger.info(`Sentinel / Shield AI listening on http://localhost:${port}`)
    logger.info(`Enterprise SOC Console available at: http://localhost:${port}/sentinel`)
  })
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use by another process. Please close it or set PORT=<other_port> in .env`)
    } else {
      logger.error('Server error', { error: err.message })
    }
  })
}

export default app
