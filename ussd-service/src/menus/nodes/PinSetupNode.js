const MenuNode = require('../MenuNode');
const { isValidPin } = require('../../utils/validators');

/**
 * PIN Setup for first-time users
 */
class PinSetupNode extends MenuNode {
  constructor() {
    super('PIN_SETUP');
  }

  async render(session) {
    return this.con('Welcome to Escrow Platform.\nSet your 4-digit PIN:');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const pin = input.trim();

    // Validate PIN format
    if (!isValidPin(pin)) {
      return {
        nextNode: 'PIN_SETUP',
        message: this.con('Invalid PIN. Must be 4 digits.\nSet your 4-digit PIN:'),
      };
    }

    // Store PIN temporarily for confirmation
    sessionStore.updateContext(session.sessionId, {
      pendingPin: pin,
    });

    return {
      nextNode: 'PIN_CONFIRM',
      message: this.con('Confirm your 4-digit PIN:'),
    };
  }
}

module.exports = PinSetupNode;
