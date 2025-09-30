import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createVoterHash } from '@/lib/hash'
import { getClientIp } from '@/lib/ip'

const VoteBody = z.object({
  option: z.number().int().min(1).max(6)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { option } = VoteBody.parse(body)
    
    // Check if poll is open
    const poll = await prisma.poll.findFirst({
      where: { id: 1 }
    })
    
    if (!poll || !poll.isOpen) {
      return NextResponse.json(
        { error: 'Voting is closed' },
        { status: 403 }
      )
    }
    
    // Check if already voted (cookie check)
    const votedCookie = request.cookies.get('era_poll_voted')
    if (votedCookie) {
      return NextResponse.json(
        { error: 'Already voted' },
        { status: 409 }
      )
    }
    
    // Create voter hash
    const ip = getClientIp()
    const userAgent = request.headers.get('user-agent') || ''
    const hashSecret = process.env.HASH_SECRET || ''
    const voterHash = createVoterHash(ip, userAgent, hashSecret)
    
    try {
      // Try to create vote (will fail if already voted due to unique constraint)
      await prisma.vote.create({
        data: {
          pollId: 1,
          option,
          voterHash
        }
      })
      
      // Set cookie to prevent future votes
      const response = NextResponse.json(
        { success: true },
        { status: 201 }
      )
      
      response.cookies.set('era_poll_voted', '1', {
        maxAge: 31536000, // 1 year
        path: '/',
        sameSite: 'lax',
        httpOnly: true
      })
      
      return response
    } catch (error: any) {
      // Check if it's a unique constraint violation
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Already voted' },
          { status: 409 }
        )
      }
      throw error
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid option. Must be between 1 and 6.' },
        { status: 400 }
      )
    }
    
    console.error('Error creating vote:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
