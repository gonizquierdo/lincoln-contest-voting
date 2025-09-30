import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isAdminRequest } from '@/lib/admin'

const StateBody = z.object({
  isOpen: z.boolean()
})

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  try {
    const body = await request.json()
    const { isOpen } = StateBody.parse(body)
    
    await prisma.poll.upsert({
      where: { id: 1 },
      update: { isOpen },
      create: { id: 1, isOpen }
    })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    console.error('Error updating poll state:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
