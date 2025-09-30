import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createVoterHash } from '@/lib/hash'
import { getClientIp } from '@/lib/ip'
import { createDeviceFingerprint, extractFingerprintFromRequest } from '@/lib/fingerprint'
import { checkRateLimit } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'

const VoteBody = z.object({
  option: z.number().int().min(1).max(6),
  dbt: z.string().optional(),
  fingerprintData: z.object({
    screenWidth: z.number().optional(),
    screenHeight: z.number().optional(),
    colorDepth: z.number().optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
    hardwareConcurrency: z.number().optional(),
    deviceMemory: z.number().optional(),
    touchSupport: z.boolean().optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { option, dbt: clientDbt, fingerprintData } = VoteBody.parse(body)
    
    // Layer D: IP Rate Limiting
    const rateLimit = await checkRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toString()
          }
        }
      )
    }
    
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
    
    // Layer A: Device-Bound Token (DBT) resolution
    let dbt = request.cookies.get('dbt')?.value || clientDbt
    
    if (!dbt) {
      // Bootstrap new device if no DBT found
      dbt = randomUUID()
      await prisma.deviceBinding.create({
        data: {
          pollId: 1,
          dbt,
          status: 'ACTIVE'
        }
      })
    }
    
    // Lookup or create device binding
    let deviceBinding = await prisma.deviceBinding.findUnique({
      where: { dbt }
    })
    
    if (!deviceBinding) {
      // Create new device binding if not found
      deviceBinding = await prisma.deviceBinding.create({
        data: {
          pollId: 1,
          dbt,
          status: 'ACTIVE'
        }
      })
    }
    
    // Check if device already voted
    if (deviceBinding.votedAt) {
      return NextResponse.json(
        { error: 'Already voted' },
        { status: 409 }
      )
    }
    
    // Layer B: Device Fingerprinting
    const serverFingerprint = extractFingerprintFromRequest(request)
    const combinedFingerprint = {
      ...serverFingerprint,
      ...fingerprintData
    }
    const deviceHash = createDeviceFingerprint(combinedFingerprint)
    
    // Check if device hash already voted
    const existingFingerprint = await prisma.fingerprintBlock.findUnique({
      where: {
        pollId_deviceHash: {
          pollId: 1,
          deviceHash
        }
      }
    })
    
    if (existingFingerprint) {
      return NextResponse.json(
        { error: 'Already voted' },
        { status: 409 }
      )
    }
    
    // Create voter hash (legacy support)
    const ip = await getClientIp()
    const userAgent = request.headers.get('user-agent') || ''
    const hashSecret = process.env.HASH_SECRET || ''
    const voterHash = createVoterHash(ip, userAgent, hashSecret)
    
    try {
      // Transaction: Create vote, update device binding, add fingerprint block
      await prisma.$transaction(async (tx: any) => {
        // Create vote
        await tx.vote.create({
          data: {
            pollId: 1,
            option,
            voterHash
          }
        })
        
        // Update device binding
        await tx.deviceBinding.update({
          where: { id: deviceBinding!.id },
          data: {
            votedAt: new Date(),
            status: 'VOTED',
            deviceHash
          }
        })
        
        // Add fingerprint block
        await tx.fingerprintBlock.upsert({
          where: {
            pollId_deviceHash: {
              pollId: 1,
              deviceHash
            }
          },
          create: {
            pollId: 1,
            deviceHash
          },
          update: {} // No update needed for existing
        })
      })
      
      // Set cookies to prevent future votes
      const response = NextResponse.json(
        { success: true },
        { status: 201 }
      )
      
      // Set DBT cookie if not already set
      if (!request.cookies.get('dbt')) {
        response.cookies.set('dbt', dbt, {
          maxAge: 31536000, // 1 year
          path: '/',
          sameSite: 'lax',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production'
        })
      }
      
      // Set legacy voted cookie
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
