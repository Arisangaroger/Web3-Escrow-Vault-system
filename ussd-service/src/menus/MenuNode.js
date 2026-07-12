/**
 * Base class for menu nodes in the USSD tree
 * Each node knows how to:
 * 1. Render itself (generate CON/END message)
 * 2. Handle user input and determine next node
 */
class MenuNode {
  constructor(id) {
    this.id = id;
  }

  /**
   * Render the menu screen
   * @param {Object} session - Current session data
   * @param {Object} backendClient - API client
   * @returns {Promise<string>} - Menu text to display
   */
  async render(session, backendClient) {
    throw new Error('render() must be implemented by subclass');
  }

  /**
   * Handle user input and determine next node
   * @param {string} input - User's input
   * @param {Object} session - Current session data
   * @param {Object} sessionStore - Session store instance
   * @param {Object} backendClient - API client
   * @returns {Promise<Object>} - { nextNode: string, updates: {} }
   */
  async handleInput(input, session, sessionStore, backendClient) {
    throw new Error('handleInput() must be implemented by subclass');
  }

  /**
   * Helper: Build a CON response (continue session)
   */
  con(message) {
    return `CON ${message}`;
  }

  /**
   * Helper: Build an END response (terminate session)
   */
  end(message) {
    return `END ${message}`;
  }
}

module.exports = MenuNode;
