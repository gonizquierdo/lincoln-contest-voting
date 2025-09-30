'use client'

import { useState, useEffect } from 'react'
import { Copy, RefreshCw, Play, Pause, Lock, Trash2, Users, Shield, RotateCcw, Check, Clock } from 'lucide-react'
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

interface DeviceData {
  id: number
  dbt: string
  status: string
  votedAt: string | null
  createdAt: string
  hasWebAuthn: boolean
}

interface DeviceStats {
  totalDevices: number
  votedDevices: number
  fingerprintBlocks: number
  rateLimitStatus: {
    count: number
    remaining: number
    resetTime: number
  }
}

interface DeviceResponse {
  devices: DeviceData[]
  stats: DeviceStats
  votesByHour: Array<{ hour: number; count: number }>
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
  const [deviceData, setDeviceData] = useState<DeviceResponse | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isHardResetting, setIsHardResetting] = useState(false)
  const [isClearingClient, setIsClearingClient] = useState(false)
  const [isResettingDevice, setIsResettingDevice] = useState(false)
  const [resetDbt, setResetDbt] = useState('')
  const [resetReason, setResetReason] = useState('')

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

      // Fetch device data
      const devicesResponse = await fetch('/api/admin/devices', {
        credentials: 'include'
      })
      if (devicesResponse.ok) {
        const devicesData = await devicesResponse.json()
        setDeviceData(devicesData)
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ hardReset: false })
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

  const hardResetPoll = async () => {
    if (!confirm('⚠️ HARD RESET WARNING ⚠️\n\nThis will completely reset the entire poll:\n• Delete ALL votes\n• Delete ALL device bindings\n• Delete ALL fingerprint blocks\n• Reset poll to open status\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
      return
    }

    if (!confirm('Last chance! This will wipe everything. Continue?')) {
      return
    }

    setIsHardResetting(true)
    try {
      const response = await fetch('/api/admin/clear-votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ hardReset: true })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`✅ ${data.message}\n\nNote: You may need to clear client data or refresh the voting page.`)
        // Refresh data after hard reset
        await fetchData()
      } else {
        alert('Error performing hard reset')
      }
    } catch (error) {
      alert('Error performing hard reset')
    } finally {
      setIsHardResetting(false)
    }
  }

  const clearClientData = async () => {
    if (!confirm('This will clear all client-side storage (cookies, localStorage, etc.) for the current browser.\n\nThis is useful after a hard reset to allow voting again from the same browser.\n\nContinue?')) {
      return
    }

    setIsClearingClient(true)
    try {
      // Clear all client-side storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Clear cookies by setting them to expire
      document.cookie = 'dbt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      document.cookie = 'era_poll_voted=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      
      // Clear IndexedDB and CacheStorage
      if ('indexedDB' in window) {
        try {
          const deleteReq = indexedDB.deleteDatabase('DevicePersistence')
          deleteReq.onsuccess = () => console.log('IndexedDB cleared')
        } catch (error) {
          console.warn('IndexedDB clear failed:', error)
        }
      }
      
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map(name => caches.delete(name)))
        } catch (error) {
          console.warn('CacheStorage clear failed:', error)
        }
      }
      
      alert('✅ Client data cleared! Please refresh the page to vote again.')
      
      // Refresh the page to reinitialize
      window.location.reload()
    } catch (error) {
      alert('Error clearing client data')
    } finally {
      setIsClearingClient(false)
    }
  }

  const resetDevice = async () => {
    if (!resetDbt.trim()) {
      alert('Please enter a device token')
      return
    }

    if (!confirm(`Are you sure you want to reset device ${resetDbt}? This will allow them to vote again.`)) {
      return
    }

    setIsResettingDevice(true)
    try {
      const response = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reset',
          dbt: resetDbt,
          reason: resetReason || 'Admin override'
        })
      })

      if (response.ok) {
        alert('Device reset successfully')
        setResetDbt('')
        setResetReason('')
        await fetchData()
      } else {
        const errorData = await response.json()
        alert(`Error resetting device: ${errorData.error}`)
      }
    } catch (error) {
      alert('Error resetting device')
    } finally {
      setIsResettingDevice(false)
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
                Clear Votes
              </Button>
              <Button
                onClick={hardResetPoll}
                disabled={isHardResetting}
                variant="destructive"
                size="sm"
                className="bg-red-600 hover:bg-red-700"
              >
                {isHardResetting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Hard Reset Poll
              </Button>
              <Button
                onClick={clearClientData}
                disabled={isClearingClient}
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                {isClearingClient ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Clear Client Data
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

      {/* Device Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl text-primary flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Device Management
          </CardTitle>
          <CardDescription>
            Monitor and manage device-based voting prevention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Device Stats */}
          {deviceData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Total Devices</span>
                </div>
                <div className="text-2xl font-bold text-primary">{deviceData.stats.totalDevices}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Voted Devices</span>
                </div>
                <div className="text-2xl font-bold text-green-600">{deviceData.stats.votedDevices}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Fingerprint Blocks</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">{deviceData.stats.fingerprintBlocks}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium">Rate Limit</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {deviceData.stats.rateLimitStatus.remaining}/{10}
                </div>
              </div>
            </div>
          )}

          {/* Device Reset */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-primary mb-2">Reset Device</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Allow a specific device to vote again by resetting their device binding
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Device Token (DBT)</label>
                <input
                  type="text"
                  value={resetDbt}
                  onChange={(e) => setResetDbt(e.target.value)}
                  placeholder="Enter device token..."
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Reason (optional)</label>
                <input
                  type="text"
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="Reason for reset..."
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                />
              </div>
            </div>
            <Button
              onClick={resetDevice}
              disabled={isResettingDevice || !resetDbt.trim()}
              variant="destructive"
              size="sm"
              className="w-full sm:w-auto"
            >
              {isResettingDevice ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Reset Device
            </Button>
          </div>

          {/* Recent Devices */}
          {deviceData && deviceData.devices.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary">Recent Devices</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {deviceData.devices.slice(0, 10).map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <div>
                        <div className="text-sm font-medium">{device.dbt}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(device.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={device.status === 'VOTED' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {device.status}
                      </Badge>
                      {device.hasWebAuthn && (
                        <Badge variant="outline" className="text-xs">
                          WebAuthn
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
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
