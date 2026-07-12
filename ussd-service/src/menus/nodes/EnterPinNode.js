const MenuNode = require('../MenuNode');
const { isValidPin } = require('../../utils/validators');

/**
 * PIN entry for action execution
 * This node executes the pending action with the backend
 */
class EnterPinNode extends MenuNode {
  constructor() {
    super('ENTER_PIN');
  }

  async render(session) {
    return this.con('Enter your 4-digit PIN:');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const pin = input.trim();

    if (!isValidPin(pin)) {
      return {
        nextNode: 'ENTER_PIN',
        message: this.con('Invalid PIN format.\nEnter your 4-digit PIN:'),
      };
    }

    const action = session.context.pendingAction;
    const dealId = session.context.selectedDealId;
    const phoneNumber = session.phoneNumber;

    try {
      let result;

      // Execute action via backend API
      switch (action) {
        case 'LOCK_FUNDS':
          result = await backendClient.lockFunds(phoneNumber, dealId, pin);
          break;

        case 'MARK_SHIPPED':
          result = await backendClient.markShipped(phoneNumber, dealId, pin);
          break;

        case 'MARK_DELIVERED':
          result = await backendClient.markDelivered(phoneNumber, dealId, pin);
          break;

        case 'CANCEL':
          result = await backendClient.cancelDeal(phoneNumber, dealId, pin);
          break;

        default:
          return {
            nextNode: 'DEAL_ACTIONS',
            message: this.end('Unknown action.'),
          };
      }

      // Handle response
      if (result.success) {
        // Clear context
        sessionStore.clearContext(session.sessionId);

        const successMessages = {
          LOCK_FUNDS: 'Funds locked successfully!\nYou will receive SMS confirmation shortly.',
          MARK_SHIPPED: 'Marked as shipped!\nDriver and receiver notified via SMS.',
          MARK_DELIVERED: 'Marked as delivered!\nAll parties notified. 3-hour dispute window started.',
          CANCEL: 'Deal cancelled successfully.',
        };

        return {
          nextNode: null,
          message: this.end(successMessages[action] || 'Action completed.'),
        };
      } else {
        // Handle specific errors
        const errorMsg = result.error || 'Action failed';

        // Check for PIN-related errors
        if (errorMsg.includes('PIN') || errorMsg.includes('locked')) {
          return {
            nextNode: 'ENTER_PIN',
            message: this.con(`${errorMsg}\nEnter PIN:`),
          };
        }

        // Other errors - end session
        return {
          nextNode: null,
          message: this.end(`Error: ${errorMsg}`),
        };
      }
    } catch (error) {
      console.error('Action execution error:', error.message);

      // Network/system error
      return {
        nextNode: null,
        message: this.end('System error. Please try again later.'),
      };
    }
  }
}

module.exports = EnterPinNode;
