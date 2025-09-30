import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminRequest } from '@/lib/admin'

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  try {
    const votes = await prisma.vote.findMany({
      where: { pollId: 1 }
    })
    
    // Count votes for each option (1-6)
    const counts = [0, 0, 0, 0, 0, 0]
    votes.forEach((vote: { option: number }) => {
      if (vote.option >= 1 && vote.option <= 6) {
        counts[vote.option - 1]++
      }
    })
    
    const total = votes.length
    
    return NextResponse.json({
      counts,
      total
    })
  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
