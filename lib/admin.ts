import { headers } from 'next/headers'
import { cookies } from 'next/headers'

export async function isAdminRequest(): Promise<boolean> {
  const headersList = headers()
  const cookieStore = await cookies()
  
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) {
    return false
  }
  
  // Check Authorization header
  const authHeader = (await headersList).get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    return token === adminKey
  }
  
  // Check cookie
  const adminCookie = cookieStore.get('admin_key')
  return adminCookie?.value === adminKey
}
