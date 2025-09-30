import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { adminKey } = body
    
    if (!adminKey) {
      return NextResponse.json(
        { error: 'Admin key is required' },
        { status: 400 }
      )
    }
    
    const expectedAdminKey = process.env.ADMIN_KEY
    if (!expectedAdminKey) {
      console.error('ADMIN_KEY environment variable not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    if (adminKey !== expectedAdminKey) {
      return NextResponse.json(
        { error: 'Invalid admin key' },
        { status: 401 }
      )
    }
    
    // Set secure cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_key', adminKey, {
      maxAge: 31536000, // 1 year
      path: '/',
      sameSite: 'lax',
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production'
    })
    
    return response
  } catch (error) {
    console.error('Admin auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Check if already authenticated
  const isAuthenticated = await isAdminRequest()
  return NextResponse.json({ isAuthenticated })
}
