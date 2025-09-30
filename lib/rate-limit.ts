import { NextRequest } from 'next/server'
import { getClientIp } from '@/lib/ip'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10 // 10 requests per minute per IP

/**
 * Check if IP has exceeded rate limit
 */
export async function checkRateLimit(request: NextRequest): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const ip = await getClientIp()
  const now = Date.now()
  
  // Clean up expired entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
  
  const entry = rateLimitStore.get(ip)
  
  if (!entry) {
    // First request from this IP
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    })
    
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetTime: now + RATE_LIMIT_WINDOW
    }
  }
  
  if (entry.resetTime < now) {
    // Window expired, reset
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    })
    
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetTime: now + RATE_LIMIT_WINDOW
    }
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    }
  }
  
  // Increment counter
  entry.count++
  rateLimitStore.set(ip, entry)
  
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * Get rate limit status for an IP
 */
export function getRateLimitStatus(ip: string): { count: number; remaining: number; resetTime: number } {
  const entry = rateLimitStore.get(ip)
  const now = Date.now()
  
  if (!entry || entry.resetTime < now) {
    return {
      count: 0,
      remaining: RATE_LIMIT_MAX_REQUESTS,
      resetTime: now + RATE_LIMIT_WINDOW
    }
  }
  
  return {
    count: entry.count,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetTime: entry.resetTime
  }
}
