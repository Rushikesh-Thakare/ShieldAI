/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse using sliding window rate limiting
 */

export class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000 // 1 minute default
    this.maxRequests = options.maxRequests || 100 // 100 requests per window default
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false
    this.requests = new Map()
  }

  /**
   * Clean up old entries outside the time window
   */
  cleanup(now) {
    const cutoff = now - this.windowMs
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter((ts) => ts > cutoff)
      if (validTimestamps.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, validTimestamps)
      }
    }
  }

  /**
   * Check if a request should be rate limited
   */
  check(identifier) {
    const now = Date.now()
    this.cleanup(now)

    const timestamps = this.requests.get(identifier) || []
    const count = timestamps.length

    if (count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        reset: timestamps[0] + this.windowMs,
      }
    }

    timestamps.push(now)
    this.requests.set(identifier, timestamps)

    return {
      allowed: true,
      remaining: this.maxRequests - timestamps.length,
      reset: now + this.windowMs,
    }
  }

  /**
   * Express middleware factory
   */
  middleware() {
    return (req, res, next) => {
      const identifier = req.ip || req.socket?.remoteAddress || 'unknown'
      const result = this.check(identifier)

      res.setHeader('RateLimit-Limit', this.maxRequests)
      res.setHeader('RateLimit-Remaining', result.remaining)
      res.setHeader('RateLimit-Reset', Math.ceil(result.reset / 1000))
      res.setHeader('X-RateLimit-Limit', this.maxRequests)
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      res.setHeader('X-RateLimit-Reset', new Date(result.reset).toISOString())

      if (!result.allowed) {
        const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
        res.setHeader('Retry-After', retryAfter.toString())

        return res.status(429).json({
          error: 'Too many requests. Please try again shortly.',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter,
        })
      }

      next()
    }
  }
}

// Pre-configured limiters
export const scanLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
})

export const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
})
