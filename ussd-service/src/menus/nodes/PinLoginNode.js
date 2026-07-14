const log = require('../../utils/logger');
const MenuNode = require('../MenuNode');
const { isValidPin } = require('../../utils/validators');

/**
 * PIN authentication for returning users
 * User must enter correct PIN to access main menu
 */
class PinLoginNode extends MenuNode {
  constructor() {
    super('PIN_LOGIN');
  }

  async render(session) {
    return this.con('Welcome back!\nEnter your 4-digit PIN:');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const pin = input.trim();

    if (!isValidPin(pin)) {
      return {
        nextNode: 'PIN_LOGIN',
        message: this.con('Invalid PIN format.\nEnter your 4-digit PIN:'),
      };
    }

    const phoneNumber = session.phoneNumber;

    try {
      // Verify PIN via backend
      const result = await backendClient.verifyPin(phoneNumber, pin);

      if (result.success) {
        // PIN is correct - proceed to main menu
        return {
          nextNode: 'MAIN_MENU',
          message: null,
        };
      } else {
        // PIN is incorrect
        const errorMsg = result.error || 'Incorrect PIN';
        
        // Check if account is locked
        if (errorMsg.includes('locked') || errorMsg.includes('attempts')) {
          return {
            nextNode: null,
            message: this.end(errorMsg),
          };
        }

        // Show retry message
        return {
          nextNode: 'PIN_LOGIN',
          message: this.con(`${errorMsg}\nEnter your 4-digit PIN:`),
        };
      }
    } catch (error) {
      log.error('Menu error', error);
      
      // Network or system error
      return {
        nextNode: null,
        message: this.end('System error. Please try again later.'),
      };
    }
  }
}

module.exports = PinLoginNode;
