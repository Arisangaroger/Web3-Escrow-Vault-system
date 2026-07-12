const MenuNode = require('../MenuNode');
const { isValidAmount } = require('../../utils/validators');

/**
 * Create deal - enter amount
 */
class CreateDealAmountNode extends MenuNode {
  constructor() {
    super('CREATE_DEAL_AMOUNT');
  }

  async render(session) {
    return this.con('Enter Deal Amount (RWF):');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const amount = input.trim();

    if (!isValidAmount(amount)) {
      return {
        nextNode: 'CREATE_DEAL_AMOUNT',
        message: this.con('Invalid amount. Must be positive number.\nEnter Amount (RWF):'),
      };
    }

    // Store amount
    sessionStore.updateContext(session.sessionId, {
      newDeal: {
        ...session.context.newDeal,
        amount,
      },
    });

    return {
      nextNode: 'CREATE_DEAL_CONFIRM',
      message: null, // Will render confirmation
    };
  }
}

module.exports = CreateDealAmountNode;
