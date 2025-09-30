import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const poll = await prisma.poll.findFirst({
      where: { id: 1 }
    })
    
    if (!poll) {
      return NextResponse.json({ isOpen: false })
    }
    
    return NextResponse.json({ isOpen: poll.isOpen })
  } catch (error) {
    console.error('Error fetching poll status:', error)
    return NextResponse.json({ isOpen: false })
  }
}
