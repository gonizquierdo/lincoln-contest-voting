import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    // Check if device already has a DBT cookie
    const existingDbt = request.cookies.get('dbt')?.value
    
    if (existingDbt) {
      // Verify the DBT exists in database
      const deviceBinding = await prisma.deviceBinding.findUnique({
        where: { dbt: existingDbt }
      })
      
      if (deviceBinding) {
        return NextResponse.json({ dbt: existingDbt })
      }
    }
    
    // Create new device binding
    const dbt = randomUUID()
    const pollId = 1 // Assuming single poll for now
    
    await prisma.deviceBinding.create({
      data: {
        pollId,
        dbt,
        status: 'ACTIVE'
      }
    })
    
    // Set HttpOnly cookie
    const response = NextResponse.json({ dbt })
    response.cookies.set('dbt', dbt, {
      maxAge: 31536000, // 1 year
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    })
    
    return response
  } catch (error) {
    console.error('Error bootstrapping device:', error)
    return NextResponse.json(
      { error: 'Failed to bootstrap device' },
      { status: 500 }
    )
  }
}
