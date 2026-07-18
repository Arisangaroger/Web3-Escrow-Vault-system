const log = require('../../utils/logger');
const MenuNode = require('../MenuNode');
const { isValidPin } = require('../../utils/validators');

/**
 * PIN entry for action execution.
 * Verifies PIN synchronously, then fire-and-forgets the chain action so USSD
 * can return END Processing… within session timeout.
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
      const verified = await backendClient.verifyPin(phoneNumber, pin);
      if (!verified.success) {
        const errorMsg = verified.error || 'Incorrect PIN';
        if (errorMsg.toLowerCase().includes('locked')) {
          return {
            nextNode: null,
            message: this.end(errorMsg),
          };
        }
        return {
          nextNode: 'ENTER_PIN',
          message: this.con(`${errorMsg}\nEnter PIN:`),
        };
      }

      let actionCall;
      switch (action) {
        case 'LOCK_FUNDS':
          actionCall = backendClient.lockFunds(phoneNumber, dealId, pin);
          break;
        case 'MARK_SHIPPED':
          actionCall = backendClient.markShipped(phoneNumber, dealId, pin);
          break;
        case 'MARK_DELIVERED':
          actionCall = backendClient.markDelivered(phoneNumber, dealId, pin);
          break;
        case 'CANCEL':
          actionCall = backendClient.cancelDeal(phoneNumber, dealId, pin);
          break;
        default:
          return {
            nextNode: 'DEAL_ACTIONS',
            message: this.end('Unknown action.'),
          };
      }

      actionCall
        .then((result) => {
          if (!result?.success) {
            log.error('Background action failed', { action, error: result?.error || result });
          }
        })
        .catch((error) => {
          if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
            log.warn('Background action still pending (client wait timed out)', {
              action,
              dealId,
              message: error.message,
            });
            return;
          }
          log.error('Background action error', error, { action });
        });

      sessionStore.clearContext(session.sessionId);

      return {
        nextNode: null,
        message: this.end(
          'Processing request...\nYou will receive an SMS when complete.'
        ),
      };
    } catch (error) {
      log.error('Menu error', error);
      return {
        nextNode: null,
        message: this.end('System error. Please try again later.'),
      };
    }
  }
}

module.exports = EnterPinNode;
