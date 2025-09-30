import { headers } from 'next/headers'

export function getClientIp(): string {
  const headersList = headers()
  
  // Check for forwarded IP first
  const forwarded = headersList.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  // Check for real IP
  const realIp = headersList.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // Fallback to connection IP (this might not work in serverless)
  return '127.0.0.1'
}
