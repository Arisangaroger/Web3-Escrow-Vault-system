const log = require('../../utils/logger');
const MenuNode = require('../MenuNode');
const { isValidPin } = require('../../utils/validators');

/**
 * PIN confirmation node
 */
class PinConfirmNode extends MenuNode {
  constructor() {
    super('PIN_CONFIRM');
  }

  async render(session) {
    return this.con('Confirm your 4-digit PIN:');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const confirmPin = input.trim();
    const pendingPin = session.context.pendingPin;

    // Validate format
    if (!isValidPin(confirmPin)) {
      return {
        nextNode: 'PIN_CONFIRM',
        message: this.con('Invalid PIN. Must be 4 digits.\nConfirm your PIN:'),
      };
    }

    // Check if PINs match
    if (confirmPin !== pendingPin) {
      // Reset and start over
      sessionStore.clearContext(session.sessionId);
      return {
        nextNode: 'PIN_SETUP',
        message: this.con('PINs do not match.\nSet your 4-digit PIN:'),
      };
    }

    // PINs match - save to backend
    try {
      const result = await backendClient.setPin(session.phoneNumber, pendingPin);
      
      if (result.success) {
        // Clear pending PIN from context
        sessionStore.updateContext(session.sessionId, {
          pendingPin: undefined,
        });

        return {
          nextNode: 'MAIN_MENU',
          message: this.con('PIN set successfully!\n\nEscrow Main Menu:\n1. My Shipments (Seller)\n2. My Deliveries (Driver)\n3. My Purchases (Buyer)\n4. Create New Deal'),
        };
      } else {
        return {
          nextNode: 'PIN_SETUP',
          message: this.con(`Error: ${result.error}\nPlease try again.\nSet your 4-digit PIN:`),
        };
      }
    } catch (error) {
      log.error('Menu error', error);
      return {
        nextNode: 'PIN_SETUP',
        message: this.con('System error. Please try again.\nSet your 4-digit PIN:'),
      };
    }
  }
}

module.exports = PinConfirmNode;
