const MenuNode = require('../MenuNode');
const { isValidChoice } = require('../../utils/validators');

/**
 * Confirm action before PIN entry
 */
class ConfirmActionNode extends MenuNode {
  constructor() {
    super('CONFIRM_ACTION');
  }

  async render(session) {
    const action = session.context.pendingAction;
    const deal = session.context.currentDeal;

    const actionMessages = {
      LOCK_FUNDS: `Lock ${deal.amount} RWF into escrow?`,
      MARK_SHIPPED: 'Mark goods as SHIPPED?',
      MARK_DELIVERED: 'Mark goods as DELIVERED?\n(Triggers 3-hour dispute window)',
      CANCEL: 'Cancel this deal?',
    };

    const message = actionMessages[action] || 'Confirm this action?';

    return this.con(`${message}\n1. Yes\n2. No`);
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const choice = input.trim();

    if (!isValidChoice(choice, 1, 2)) {
      return {
        nextNode: 'CONFIRM_ACTION',
        message: this.con('Invalid choice.\n1. Yes\n2. No'),
      };
    }

    const choiceNum = parseInt(choice);

    if (choiceNum === 2) {
      // Cancel - back to deal actions
      sessionStore.updateContext(session.sessionId, {
        pendingAction: undefined,
      });
      return {
        nextNode: 'DEAL_ACTIONS',
        message: null,
      };
    }

    // Proceed to PIN entry
    return {
      nextNode: 'ENTER_PIN',
      message: this.con('Enter your 4-digit PIN:'),
    };
  }
}

module.exports = ConfirmActionNode;
