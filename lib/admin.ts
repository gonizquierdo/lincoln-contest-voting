import { headers } from 'next/headers'
import { cookies } from 'next/headers'

export async function isAdminRequest(): Promise<boolean> {
  const headersList = headers()
  const cookieStore = await cookies()
  
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) {
    console.error('ADMIN_KEY environment variable not set')
    return false
  }
  
  // Check Authorization header
  const authHeader = (await headersList).get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const isValid = token === adminKey
    console.log('Admin auth via header:', { isValid, tokenLength: token.length, adminKeyLength: adminKey.length })
    return isValid
  }
  
  // Check cookie
  const adminCookie = cookieStore.get('admin_key')
  const isValid = adminCookie?.value === adminKey
  console.log('Admin auth via cookie:', { 
    isValid, 
    hasCookie: !!adminCookie, 
    cookieValue: adminCookie?.value?.substring(0, 4) + '...',
    adminKeyValue: adminKey.substring(0, 4) + '...',
    cookieLength: adminCookie?.value?.length,
    adminKeyLength: adminKey.length
  })
  return isValid
}
