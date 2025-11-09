import { Request, Response, NextFunction } from 'express'

// Simple in-memory cache
interface CacheEntry {
  data: any
  timestamp: number
  etag: string
}

const cache = new Map<string, CacheEntry>()

// Cache TTL in milliseconds
const DEFAULT_TTL = 60 * 1000 // 1 minute
const DEPARTMENTS_TTL = 5 * 60 * 1000 // 5 minutes (departments rarely change)
const STATS_TTL = 30 * 1000 // 30 seconds (stats need fresher data)

/**
 * Simple cache middleware for GET requests
 * Caches responses in memory with ETag support
 */
export function cacheMiddleware(ttl: number = DEFAULT_TTL) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    const key = req.originalUrl || req.url
    const cached = cache.get(key)

    // Check if we have a valid cached response
    if (cached && Date.now() - cached.timestamp < ttl) {
      // Check if client sent If-None-Match header
      const clientEtag = req.headers['if-none-match']
      if (clientEtag === cached.etag) {
        return res.status(304).end() // Not Modified
      }

      // Send cached response with ETag
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('ETag', cached.etag)
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`)
      return res.json(cached.data)
    }

    // Cache miss - intercept res.json to store the response
    const originalJson = res.json.bind(res)
    res.json = function (data: any) {
      // Generate ETag based on data
      const etag = `"${Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 27)}"`
      
      // Store in cache
      cache.set(key, {
        data,
        timestamp: Date.now(),
        etag
      })

      // Set cache headers
      res.setHeader('X-Cache', 'MISS')
      res.setHeader('ETag', etag)
      res.setHeader('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`)

      return originalJson(data)
    }

    next()
  }
}

/**
 * Cache middleware with specific TTL for departments
 */
export const cacheDepartments = cacheMiddleware(DEPARTMENTS_TTL)

/**
 * Cache middleware with specific TTL for statistics
 */
export const cacheStats = cacheMiddleware(STATS_TTL)

/**
 * Clear cache for a specific key or all keys
 */
export function clearCache(key?: string) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}

/**
 * Clear cache entries older than their TTL
 * Call this periodically to prevent memory leaks
 */
export function pruneCache() {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > DEFAULT_TTL * 2) {
      cache.delete(key)
    }
  }
}

// Prune cache every 5 minutes
setInterval(pruneCache, 5 * 60 * 1000)
