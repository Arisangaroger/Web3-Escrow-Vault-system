/**
 * In-memory session store with automatic timeout and cleanup
 * Tracks USSD session state across multiple request/response cycles
 */
class SessionStore {
  constructor(timeoutSeconds = 90, cleanupIntervalMs = 60000) {
    this.sessions = new Map();
    this.timeoutMs = timeoutSeconds * 1000;
    this.cleanupIntervalMs = cleanupIntervalMs;
    
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Create a new session
   */
  createSession(sessionId, phoneNumber) {
    const now = Date.now();
    const session = {
      sessionId,
      phoneNumber,
      currentNode: 'INITIAL', // Will be set to MAIN_MENU or PIN_SETUP
      context: {},
      createdAt: now,
      lastActivityAt: now,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get existing session or return null if expired/not found
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - session.lastActivityAt > this.timeoutMs) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session activity timestamp
   */
  touchSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Update session data
   */
  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Update session context (partial merge)
   */
  updateContext(sessionId, contextUpdates) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = { ...session.context, ...contextUpdates };
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Clear session context
   */
  clearContext(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = {};
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;

      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastActivityAt > this.timeoutMs) {
          this.sessions.delete(sessionId);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.log(`🧹 Cleaned up ${expiredCount} expired session(s)`);
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * Get session count (for monitoring)
   */
  getSessionCount() {
    return this.sessions.size;
  }
}

module.exports = SessionStore;
