import { spawn } from 'node:child_process'

const children = [
  spawn(process.execPath, ['--watch', 'server.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
]

let stopping = false

function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null) child.kill()
  }
  process.exitCode = code
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start development process:', error.message)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping) stop(code || 0)
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
