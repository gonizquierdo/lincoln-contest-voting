import { createHash } from 'crypto'

export function createVoterHash(ip: string, userAgent: string, secret: string): string {
  const data = `${ip}|${userAgent}|${secret}`
  return createHash('sha256').update(data).digest('hex')
}
