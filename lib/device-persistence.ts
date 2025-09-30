/**
 * Client-side device persistence strategy ("Evercookie-lite")
 * Stores device-bound token redundantly across multiple storage mechanisms
 */

const DBT_KEY = 'dbt'
const HAS_VOTED_KEY = 'hasVoted'

export class DevicePersistence {
  /**
   * Recover DBT from various storage mechanisms in order of preference
   */
  static async recoverDbt(): Promise<string | null> {
    // 1. Try localStorage first (most reliable)
    const localStorageDbt = localStorage.getItem(DBT_KEY)
    if (localStorageDbt) return localStorageDbt
    
    // 2. Try sessionStorage
    const sessionStorageDbt = sessionStorage.getItem(DBT_KEY)
    if (sessionStorageDbt) return sessionStorageDbt
    
    // 3. Try IndexedDB
    try {
      const indexedDbDbt = await this.getFromIndexedDB(DBT_KEY)
      if (indexedDbDbt) return indexedDbDbt
    } catch (error) {
      console.warn('IndexedDB access failed:', error)
    }
    
    // 4. Try CacheStorage
    try {
      const cacheDbt = await this.getFromCacheStorage(DBT_KEY)
      if (cacheDbt) return cacheDbt
    } catch (error) {
      console.warn('CacheStorage access failed:', error)
    }
    
    return null
  }
  
  /**
   * Store DBT across all available storage mechanisms
   */
  static async storeDbt(dbt: string): Promise<void> {
    // Store in localStorage
    localStorage.setItem(DBT_KEY, dbt)
    
    // Store in sessionStorage
    sessionStorage.setItem(DBT_KEY, dbt)
    
    // Store in IndexedDB
    try {
      await this.setInIndexedDB(DBT_KEY, dbt)
    } catch (error) {
      console.warn('IndexedDB storage failed:', error)
    }
    
    // Store in CacheStorage
    try {
      await this.setInCacheStorage(DBT_KEY, dbt)
    } catch (error) {
      console.warn('CacheStorage storage failed:', error)
    }
  }
  
  /**
   * Check if user has voted (client-side check)
   */
  static hasVoted(): boolean {
    return localStorage.getItem(HAS_VOTED_KEY) === 'true'
  }
  
  /**
   * Mark as voted
   */
  static markAsVoted(): void {
    localStorage.setItem(HAS_VOTED_KEY, 'true')
  }
  
  /**
   * Clear all stored data (for testing/admin purposes)
   */
  static async clearAll(): Promise<void> {
    localStorage.removeItem(DBT_KEY)
    localStorage.removeItem(HAS_VOTED_KEY)
    sessionStorage.removeItem(DBT_KEY)
    
    try {
      await this.deleteFromIndexedDB(DBT_KEY)
    } catch (error) {
      console.warn('IndexedDB clear failed:', error)
    }
    
    try {
      await this.deleteFromCacheStorage(DBT_KEY)
    } catch (error) {
      console.warn('CacheStorage clear failed:', error)
    }
  }

  /**
   * Clear only the voted state (useful after hard reset)
   */
  static clearVotedState(): void {
    localStorage.removeItem(HAS_VOTED_KEY)
  }
  
  // IndexedDB helpers
  private static async getFromIndexedDB(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DevicePersistence', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['storage'], 'readonly')
        const store = transaction.objectStore('storage')
        const getRequest = store.get(key)
        
        getRequest.onsuccess = () => resolve(getRequest.result?.value || null)
        getRequest.onerror = () => reject(getRequest.error)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage')
        }
      }
    })
  }
  
  private static async setInIndexedDB(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DevicePersistence', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['storage'], 'readwrite')
        const store = transaction.objectStore('storage')
        const putRequest = store.put({ value }, key)
        
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage')
        }
      }
    })
  }
  
  private static async deleteFromIndexedDB(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DevicePersistence', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['storage'], 'readwrite')
        const store = transaction.objectStore('storage')
        const deleteRequest = store.delete(key)
        
        deleteRequest.onsuccess = () => resolve()
        deleteRequest.onerror = () => reject(deleteRequest.error)
      }
    })
  }
  
  // CacheStorage helpers
  private static async getFromCacheStorage(key: string): Promise<string | null> {
    if (!('caches' in window)) return null
    
    try {
      const cache = await caches.open('device-persistence')
      const response = await cache.match(key)
      if (response) {
        return await response.text()
      }
    } catch (error) {
      console.warn('CacheStorage get failed:', error)
    }
    
    return null
  }
  
  private static async setInCacheStorage(key: string, value: string): Promise<void> {
    if (!('caches' in window)) return
    
    try {
      const cache = await caches.open('device-persistence')
      await cache.put(key, new Response(value))
    } catch (error) {
      console.warn('CacheStorage set failed:', error)
    }
  }
  
  private static async deleteFromCacheStorage(key: string): Promise<void> {
    if (!('caches' in window)) return
    
    try {
      const cache = await caches.open('device-persistence')
      await cache.delete(key)
    } catch (error) {
      console.warn('CacheStorage delete failed:', error)
    }
  }
}
