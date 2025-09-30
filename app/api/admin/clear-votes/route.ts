import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminRequest } from '@/lib/admin'

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  try {
    const body = await request.json()
    const { hardReset } = body || {}
    
    if (hardReset) {
      // Hard reset: Clear everything
      await prisma.$transaction(async (tx: any) => {
        // Clear all votes
        await tx.vote.deleteMany({
          where: { pollId: 1 }
        })
        
        // Clear all device bindings
        await tx.deviceBinding.deleteMany({
          where: { pollId: 1 }
        })
        
        // Clear all fingerprint blocks
        await tx.fingerprintBlock.deleteMany({
          where: { pollId: 1 }
        })
        
        // Reset poll status to open
        await tx.poll.update({
          where: { id: 1 },
          data: { isOpen: true }
        })
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'Hard reset completed - all data cleared',
        resetType: 'hard'
      })
    } else {
      // Soft reset: Only clear votes
      const result = await prisma.vote.deleteMany({
        where: { pollId: 1 }
      })
      
      return NextResponse.json({ 
        success: true, 
        deletedCount: result.count,
        resetType: 'soft'
      })
    }
  } catch (error) {
    console.error('Error clearing data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
