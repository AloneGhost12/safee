/**
 * Inactivity Detection Service
 * 
 * This service tracks user activity and automatically triggers logout
 * after 10 minutes of inactivity.
 */

export type ActivityEvent = 'mousedown' | 'mousemove' | 'keypress' | 'scroll' | 'touchstart' | 'click'

export interface InactivityDetectorConfig {
  timeoutMinutes: number
  onTimeout: () => void
  onWarning?: (remainingSeconds: number) => void
  warningBeforeTimeoutSeconds?: number
  activityEvents?: ActivityEvent[]
}

export class InactivityDetector {
  private timeoutId: NodeJS.Timeout | null = null
  private warningTimeoutId: NodeJS.Timeout | null = null
  private lastActivityTime: number = Date.now()
  private config: Required<InactivityDetectorConfig>
  private isActive: boolean = false
  private boundActivityHandler: () => void

  constructor(config: InactivityDetectorConfig) {
    this.config = {
      timeoutMinutes: config.timeoutMinutes,
      onTimeout: config.onTimeout,
      onWarning: config.onWarning || (() => {}),
      warningBeforeTimeoutSeconds: config.warningBeforeTimeoutSeconds || 60,
      activityEvents: config.activityEvents || ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    }

    // Bind the activity handler to maintain 'this' context
    this.boundActivityHandler = this.handleActivity.bind(this)
  }

  /**
   * Start monitoring for inactivity
   */
  start(): void {
    if (this.isActive) {
      console.log('⚠️ InactivityDetector already started')
      return
    }

    console.log(`🕒 Starting inactivity detection (${this.config.timeoutMinutes} minutes timeout)`)
    this.isActive = true
    this.lastActivityTime = Date.now()
    
    // Add event listeners for user activity
    this.addActivityListeners()
    
    // Start the inactivity timer
    this.resetTimer()
  }

  /**
   * Stop monitoring for inactivity
   */
  stop(): void {
    if (!this.isActive) {
      return
    }

    console.log('🛑 Stopping inactivity detection')
    this.isActive = false
    
    // Remove event listeners
    this.removeActivityListeners()
    
    // Clear timers
    this.clearTimers()
  }

  /**
   * Reset the inactivity timer due to user activity
   */
  private resetTimer(): void {
    if (!this.isActive) return

    // Clear existing timers
    this.clearTimers()

    const timeoutMs = this.config.timeoutMinutes * 60 * 1000
    const warningMs = timeoutMs - (this.config.warningBeforeTimeoutSeconds * 1000)

    // Set warning timer (if configured)
    if (this.config.warningBeforeTimeoutSeconds > 0 && warningMs > 0) {
      this.warningTimeoutId = setTimeout(() => {
        if (this.isActive && this.config.onWarning) {
          console.log(`⚠️ Inactivity warning: ${this.config.warningBeforeTimeoutSeconds} seconds until logout`)
          this.config.onWarning(this.config.warningBeforeTimeoutSeconds)
        }
      }, warningMs)
    }

    // Set main timeout timer
    this.timeoutId = setTimeout(() => {
      if (this.isActive) {
        console.log('⏰ Inactivity timeout reached - triggering logout')
        this.config.onTimeout()
      }
    }, timeoutMs)
  }

  /**
   * Handle user activity events
   */
  private handleActivity(): void {
    if (!this.isActive) return

    const now = Date.now()
    
    // Throttle activity detection to avoid excessive timer resets
    // Only reset if more than 1 second has passed since last activity
    if (now - this.lastActivityTime > 1000) {
      this.lastActivityTime = now
      this.resetTimer()
    }
  }

  /**
   * Add activity event listeners
   */
  private addActivityListeners(): void {
    this.config.activityEvents.forEach(event => {
      document.addEventListener(event, this.boundActivityHandler, { passive: true })
    })
  }

  /**
   * Remove activity event listeners
   */
  private removeActivityListeners(): void {
    this.config.activityEvents.forEach(event => {
      document.removeEventListener(event, this.boundActivityHandler)
    })
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId)
      this.warningTimeoutId = null
    }
  }

  /**
   * Get remaining time until timeout (in seconds)
   */
  getRemainingTime(): number {
    if (!this.isActive) return 0
    
    const timeoutMs = this.config.timeoutMinutes * 60 * 1000
    const elapsed = Date.now() - this.lastActivityTime
    const remaining = Math.max(0, timeoutMs - elapsed)
    
    return Math.floor(remaining / 1000)
  }

  /**
   * Check if the detector is currently active
   */
  isRunning(): boolean {
    return this.isActive
  }

  /**
   * Manually trigger activity (useful for API calls, etc.)
   */
  recordActivity(): void {
    this.handleActivity()
  }
}

// Singleton instance for app-wide use
let globalInactivityDetector: InactivityDetector | null = null

export function createInactivityDetector(config: InactivityDetectorConfig): InactivityDetector {
  if (globalInactivityDetector) {
    globalInactivityDetector.stop()
  }
  
  globalInactivityDetector = new InactivityDetector(config)
  return globalInactivityDetector
}

export function getInactivityDetector(): InactivityDetector | null {
  return globalInactivityDetector
}

export function stopGlobalInactivityDetector(): void {
  if (globalInactivityDetector) {
    globalInactivityDetector.stop()
    globalInactivityDetector = null
  }
}
