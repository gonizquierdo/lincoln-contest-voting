import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRateLimitStatus } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/ip'

export async function GET(request: NextRequest) {
  try {
    // Get device bindings with vote status
    const devices = await prisma.deviceBinding.findMany({
      where: { pollId: 1 },
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to recent 100 devices
    })
    
    // Get fingerprint blocks count
    const fingerprintBlocks = await prisma.fingerprintBlock.count({
      where: { pollId: 1 }
    })
    
    // Get vote counts by hour
    const votesByHour = await prisma.vote.groupBy({
      by: ['createdAt'],
      where: {
        pollId: 1,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      _count: true
    })
    
    // Get rate limit status for current IP
    const currentIp = await getClientIp()
    const rateLimitStatus = getRateLimitStatus(currentIp)
    
    return NextResponse.json({
      devices: devices.map(device => ({
        id: device.id,
        dbt: device.dbt.substring(0, 8) + '...', // Truncate for privacy
        status: device.status,
        votedAt: device.votedAt,
        createdAt: device.createdAt,
        hasWebAuthn: !!device.webauthnId
      })),
      stats: {
        totalDevices: devices.length,
        votedDevices: devices.filter(d => d.votedAt).length,
        fingerprintBlocks,
        rateLimitStatus
      },
      votesByHour: votesByHour.map(v => ({
        hour: new Date(v.createdAt).getHours(),
        count: v._count
      }))
    })
  } catch (error) {
    console.error('Error fetching device data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch device data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, dbt, reason } = body
    
    if (action === 'reset') {
      if (!dbt) {
        return NextResponse.json(
          { error: 'DBT is required for reset' },
          { status: 400 }
        )
      }
      
      // Find device binding
      const deviceBinding = await prisma.deviceBinding.findUnique({
        where: { dbt }
      })
      
      if (!deviceBinding) {
        return NextResponse.json(
          { error: 'Device not found' },
          { status: 404 }
        )
      }
      
      // Reset device binding
      await prisma.$transaction(async (tx) => {
        // Reset device binding
        await tx.deviceBinding.update({
          where: { id: deviceBinding.id },
          data: {
            votedAt: null,
            status: 'ACTIVE'
          }
        })
        
        // Remove fingerprint block if exists
        if (deviceBinding.deviceHash) {
          await tx.fingerprintBlock.deleteMany({
            where: {
              pollId: 1,
              deviceHash: deviceBinding.deviceHash
            }
          })
        }
        
        // Remove vote if exists (optional - you might want to keep vote history)
        await tx.vote.deleteMany({
          where: {
            pollId: 1,
            voterHash: {
              contains: dbt.substring(0, 8) // Partial match for privacy
            }
          }
        })
      })
      
      // Log the override action
      console.log(`Admin override: Reset device ${dbt.substring(0, 8)}... Reason: ${reason || 'No reason provided'}`)
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error processing admin action:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}
