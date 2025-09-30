import { createHash } from 'crypto'

export interface DeviceFingerprintData {
  userAgent: string
  platform?: string
  model?: string
  screenWidth?: number
  screenHeight?: number
  colorDepth?: number
  language?: string
  timezone?: string
  hardwareConcurrency?: number
  deviceMemory?: number
  touchSupport?: boolean
}

/**
 * Creates a device fingerprint hash from browser characteristics
 * Uses non-high-entropy features to reduce privacy impact
 */
export function createDeviceFingerprint(data: DeviceFingerprintData): string {
  const fingerprint = [
    data.userAgent,
    data.platform || '',
    data.model || '',
    data.screenWidth?.toString() || '',
    data.screenHeight?.toString() || '',
    data.colorDepth?.toString() || '',
    data.language || '',
    data.timezone || '',
    data.hardwareConcurrency?.toString() || '',
    data.deviceMemory?.toString() || '',
    data.touchSupport?.toString() || ''
  ].join('|')
  
  // Add server secret for additional security
  const secret = process.env.FINGERPRINT_SECRET || 'default-secret-change-in-production'
  const saltedFingerprint = `${fingerprint}|${secret}`
  
  return createHash('sha256').update(saltedFingerprint).digest('hex')
}

/**
 * Extracts device fingerprint data from request headers
 */
export function extractFingerprintFromRequest(request: Request): DeviceFingerprintData {
  const userAgent = request.headers.get('user-agent') || ''
  
  // Extract Client Hints
  const platform = request.headers.get('sec-ch-ua-platform')?.replace(/"/g, '')
  const model = request.headers.get('sec-ch-ua-model')?.replace(/"/g, '')
  
  // Parse additional headers that might be sent by client
  const acceptLanguage = request.headers.get('accept-language') || ''
  const language = acceptLanguage.split(',')[0]?.split('-')[0] || ''
  
  return {
    userAgent,
    platform,
    model,
    language
  }
}

/**
 * Client-side function to collect device fingerprint data
 * This will be sent to the server for fingerprinting
 */
export function collectClientFingerprintData(): Partial<DeviceFingerprintData> {
  if (typeof window === 'undefined') return {}
  
  return {
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    colorDepth: window.screen?.colorDepth,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }
}
