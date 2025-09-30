'use client'

import { useState, useEffect } from 'react'
import { Check, Lock, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DevicePersistence } from '@/lib/device-persistence'
import { collectClientFingerprintData } from '@/lib/fingerprint'

interface PollStatus {
  isOpen: boolean
}

interface VoteState {
  status: 'loading' | 'voting' | 'voted' | 'already_voted' | 'closed' | 'error'
  message?: string
}

const ERA_OPTIONS = [
  { id: 1, name: 'The 60s', description: 'Swinging Sixties' },
  { id: 2, name: 'The 70s', description: 'Disco Era' },
  { id: 3, name: 'The 80s', description: 'Synthwave & Neon' },
  { id: 4, name: 'The 90s', description: 'Grunge & Tech Boom' },
  { id: 5, name: 'The 2000s', description: 'Y2K & Social Media' },
  { id: 6, name: 'The 2010s', description: 'Smartphone Era' }
]

export default function VotingPage() {
  const [pollStatus, setPollStatus] = useState<PollStatus>({ isOpen: true })
  const [voteState, setVoteState] = useState<VoteState>({ status: 'loading' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dbt, setDbt] = useState<string | null>(null)

  useEffect(() => {
    initializeDevice()
    checkPollStatus()
  }, [])

  const initializeDevice = async () => {
    try {
      // Try to recover existing DBT
      let recoveredDbt = await DevicePersistence.recoverDbt()
      
      if (!recoveredDbt) {
        // Bootstrap new device
        const response = await fetch('/api/device/bootstrap')
        const data = await response.json()
        recoveredDbt = data.dbt
        
        // Store DBT across all storage mechanisms
        await DevicePersistence.storeDbt(recoveredDbt || '')
      }
      
      setDbt(recoveredDbt)
      
      // Check if already voted on client side
      const clientHasVoted = DevicePersistence.hasVoted()
      
      if (clientHasVoted) {
        // Verify with server if we actually voted
        try {
          const testResponse = await fetch('/api/vote', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              option: 1, // Dummy option for test
              dbt: recoveredDbt,
              fingerprintData: collectClientFingerprintData()
            }),
          })
          
          if (testResponse.status === 409) {
            // Server confirms we voted
            setVoteState({ status: 'already_voted' })
          } else {
            // Server says we haven't voted, clear client state
            DevicePersistence.clearVotedState()
            setVoteState({ status: 'voting' })
          }
        } catch (error) {
          // If verification fails, trust client state
          setVoteState({ status: 'already_voted' })
        }
      } else {
        setVoteState({ status: 'voting' })
      }
    } catch (error) {
      console.error('Error initializing device:', error)
      setVoteState({ status: 'error', message: 'Failed to initialize device' })
    }
  }

  const checkPollStatus = async () => {
    try {
      const response = await fetch('/api/poll')
      const data = await response.json()
      setPollStatus(data)
    } catch (error) {
      console.error('Error checking poll status:', error)
    }
  }

  const handleVote = async (option: number) => {
    if (!pollStatus.isOpen || voteState.status !== 'voting' || isSubmitting || !dbt) {
      return
    }

    setIsSubmitting(true)
    setVoteState({ status: 'loading' })

    try {
      // Collect device fingerprint data
      const fingerprintData = collectClientFingerprintData()
      
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          option, 
          dbt,
          fingerprintData 
        }),
      })

      if (response.status === 201) {
        // Mark as voted in client storage
        DevicePersistence.markAsVoted()
        setVoteState({ status: 'voted' })
      } else if (response.status === 409) {
        setVoteState({ status: 'already_voted' })
      } else if (response.status === 403) {
        setVoteState({ status: 'closed' })
      } else {
        const errorData = await response.json()
        setVoteState({ 
          status: 'error', 
          message: errorData.error || 'Error submitting vote' 
        })
      }
    } catch (error) {
      setVoteState({ 
        status: 'error', 
        message: 'Network error. Please try again.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderVotingForm = () => (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <CardTitle className="text-3xl sm:text-4xl text-primary">
          Vote your favorite era
        </CardTitle>
        <CardDescription className="text-base sm:text-lg">
          Choose the decade that resonates most with you
        </CardDescription>
      </div>

      {!pollStatus.isOpen && (
        <Alert className="border-destructive bg-destructive/10">
          <Clock className="h-4 w-4" />
          <AlertDescription className="font-semibold">
            Voting is currently closed
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {ERA_OPTIONS.map((era) => (
          <Card 
            key={era.id}
            className="group relative cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-2 hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleVote(era.id)}
          >
            <CardContent className="p-6">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-primary group-hover:text-primary transition-colors">
                  {era.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {era.description}
                </p>
              </div>
              {isSubmitting && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/90 rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderVotedState = () => (
    <div className="text-center space-y-8">
      <div className="mx-auto w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-lg">
        <Check className="w-10 h-10 text-primary-foreground" />
      </div>
      <div className="space-y-2">
        <CardTitle className="text-3xl text-primary">
          ¡Gracias por votar!
        </CardTitle>
        <CardDescription className="text-lg">
          Tu voto fue registrado exitosamente.
        </CardDescription>
      </div>
    </div>
  )

  const renderAlreadyVotedState = () => (
    <div className="text-center space-y-8">
      <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center shadow-lg">
        <Lock className="w-10 h-10 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <CardTitle className="text-3xl text-primary">
          Ya votaste
        </CardTitle>
        <CardDescription className="text-lg">
          Solo se permite un voto por persona.
        </CardDescription>
      </div>
    </div>
  )

  const renderClosedState = () => (
    <div className="text-center space-y-8">
      <div className="mx-auto w-20 h-20 bg-destructive rounded-full flex items-center justify-center shadow-lg">
        <Clock className="w-10 h-10 text-destructive-foreground" />
      </div>
      <div className="space-y-2">
        <CardTitle className="text-3xl text-primary">
          Votación cerrada
        </CardTitle>
        <CardDescription className="text-lg">
          La votación no está disponible en este momento.
        </CardDescription>
      </div>
    </div>
  )

  const renderErrorState = () => (
    <div className="text-center space-y-8">
      <div className="mx-auto w-20 h-20 bg-destructive rounded-full flex items-center justify-center shadow-lg">
        <Lock className="w-10 h-10 text-destructive-foreground" />
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <CardTitle className="text-3xl text-primary">
            Error
          </CardTitle>
          <CardDescription className="text-lg">
            {voteState.message || 'Ocurrió un error inesperado.'}
          </CardDescription>
        </div>
        <Button 
          onClick={() => setVoteState({ status: 'voting' })}
          size="lg"
        >
          Intentar de nuevo
        </Button>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (voteState.status) {
      case 'loading':
        return (
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <CardDescription className="text-lg">Cargando...</CardDescription>
          </div>
        )
      case 'voted':
        return renderVotedState()
      case 'already_voted':
        return renderAlreadyVotedState()
      case 'closed':
        return renderClosedState()
      case 'error':
        return renderErrorState()
      case 'voting':
      default:
        return renderVotingForm()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-6xl">
        <Card>
          <CardContent className="p-8">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}