'use client'

import { useState, useEffect } from 'react'
import { Copy, RefreshCw, Play, Pause, Lock, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

interface AdminAuth {
  isAuthenticated: boolean
  isLoading: boolean
}

interface PollStatus {
  isOpen: boolean
}

interface Results {
  counts: number[]
  total: number
}

const ERA_OPTIONS = [
  { id: 1, name: 'The 60s', description: 'Swinging Sixties' },
  { id: 2, name: 'The 70s', description: 'Disco Era' },
  { id: 3, name: 'The 80s', description: 'Synthwave & Neon' },
  { id: 4, name: 'The 90s', description: 'Grunge & Tech Boom' },
  { id: 5, name: 'The 2000s', description: 'Y2K & Social Media' },
  { id: 6, name: 'The 2010s', description: 'Smartphone Era' }
]

export default function AdminPage() {
  const [auth, setAuth] = useState<AdminAuth>({ isAuthenticated: false, isLoading: true })
  const [adminKey, setAdminKey] = useState('')
  const [pollStatus, setPollStatus] = useState<PollStatus>({ isOpen: true })
  const [results, setResults] = useState<Results>({ counts: [0, 0, 0, 0, 0, 0], total: 0 })
  const [isUpdating, setIsUpdating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  useEffect(() => {
    checkAuth()
    if (auth.isAuthenticated) {
      fetchData()
      // Auto-refresh every 3 seconds
      const interval = setInterval(fetchData, 3000)
      return () => clearInterval(interval)
    }
  }, [auth.isAuthenticated])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/results', {
        credentials: 'include'
      })
      
      if (response.status === 401) {
        setAuth({ isAuthenticated: false, isLoading: false })
      } else if (response.ok) {
        setAuth({ isAuthenticated: true, isLoading: false })
      } else {
        setAuth({ isAuthenticated: false, isLoading: false })
      }
    } catch (error) {
      setAuth({ isAuthenticated: false, isLoading: false })
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminKey.trim()) return

    try {
      // Set admin key cookie
      document.cookie = `admin_key=${adminKey}; path=/; max-age=31536000; samesite=lax`
      
      // Test authentication
      const response = await fetch('/api/admin/results', {
        credentials: 'include'
      })
      
      if (response.ok) {
        setAuth({ isAuthenticated: true, isLoading: false })
        setAdminKey('')
      } else {
        alert('Invalid admin key')
      }
    } catch (error) {
      alert('Error authenticating')
    }
  }

  const fetchData = async () => {
    try {
      // Fetch poll status
      const pollResponse = await fetch('/api/poll')
      const pollData = await pollResponse.json()
      setPollStatus(pollData)

      // Fetch results
      const resultsResponse = await fetch('/api/admin/results', {
        credentials: 'include'
      })
      if (resultsResponse.ok) {
        const resultsData = await resultsResponse.json()
        setResults(resultsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const togglePollStatus = async () => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isOpen: !pollStatus.isOpen }),
      })

      if (response.ok) {
        setPollStatus(prev => ({ ...prev, isOpen: !prev.isOpen }))
      } else {
        alert('Error updating poll status')
      }
    } catch (error) {
      alert('Error updating poll status')
    } finally {
      setIsUpdating(false)
    }
  }

  const copyResults = () => {
    const jsonData = JSON.stringify({
      pollStatus,
      results,
      timestamp: new Date().toISOString()
    }, null, 2)
    
    navigator.clipboard.writeText(jsonData)
    alert('Results copied to clipboard!')
  }

  const clearAllVotes = async () => {
    if (!confirm('Are you sure you want to clear all votes? This action cannot be undone.')) {
      return
    }

    setIsClearing(true)
    try {
      const response = await fetch('/api/admin/clear-votes', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully cleared ${data.deletedCount} votes`)
        // Refresh data after clearing
        await fetchData()
      } else {
        alert('Error clearing votes')
      }
    } catch (error) {
      alert('Error clearing votes')
    } finally {
      setIsClearing(false)
    }
  }

  const renderLoginForm = () => (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg">
            <Lock className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl text-primary">Admin Access</CardTitle>
            <CardDescription className="text-lg">Enter admin key to continue</CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Admin Key"
                className="w-full px-4 py-4 border-2 border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors text-lg"
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Access Admin Panel
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )

  const renderAdminPanel = () => (
    <div className="space-y-8">
      {/* Header */}
      <Card className="bg-primary text-primary-foreground border-primary">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-2xl sm:text-3xl text-primary-foreground">Admin Panel</CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                onClick={copyResults}
                variant="secondary"
                size="sm"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <Copy className="w-4 h-4" />
                Copy JSON
              </Button>
              <Button
                onClick={fetchData}
                variant="secondary"
                size="sm"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Button
                onClick={clearAllVotes}
                disabled={isClearing || results.total === 0}
                variant="destructive"
                size="sm"
              >
                {isClearing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Clear All Votes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Poll Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-3">
              <CardTitle className="text-xl sm:text-2xl text-primary">Poll Status</CardTitle>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <Badge 
                  variant={pollStatus.isOpen ? "default" : "destructive"}
                  className="text-sm font-semibold"
                >
                  {pollStatus.isOpen ? 'Open' : 'Closed'}
                </Badge>
                <CardDescription className="text-sm">
                  {pollStatus.isOpen ? 'Voting is currently active' : 'Voting is disabled'}
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={togglePollStatus}
              disabled={isUpdating}
              variant={pollStatus.isOpen ? 'destructive' : 'default'}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isUpdating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : pollStatus.isOpen ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {pollStatus.isOpen ? 'Close Poll' : 'Open Poll'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl text-primary">Live Results</CardTitle>
              <CardDescription>Real-time voting statistics</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                <span className="text-2xl font-bold">{results.total}</span>
                <span className="ml-2 text-sm">Total Votes</span>
              </Badge>
              <CardDescription className="text-sm">
                Last updated: {new Date().toLocaleTimeString()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {ERA_OPTIONS.map((era, index) => {
            const count = results.counts[index] || 0
            const percentage = results.total > 0 ? (count / results.total) * 100 : 0
            
            return (
              <div key={era.id} className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{era.name}</h3>
                    <CardDescription className="text-sm">{era.description}</CardDescription>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-xl font-bold text-primary">{count}</div>
                    <CardDescription className="text-sm">{percentage.toFixed(1)}%</CardDescription>
                  </div>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-3"
                />
              </div>
            )
          })}

          {results.total === 0 && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <span className="text-2xl">📊</span>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-lg text-muted-foreground">No votes yet</CardTitle>
                <CardDescription>Results will appear here once voting begins</CardDescription>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <CardDescription className="text-lg">Loading admin panel...</CardDescription>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-7xl mx-auto">
        {auth.isAuthenticated ? renderAdminPanel() : renderLoginForm()}
      </div>
    </div>
  )
}
