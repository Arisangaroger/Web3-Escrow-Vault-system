const MenuNode = require('../MenuNode');
const { isValidChoice, isValidPin } = require('../../utils/validators');

/**
 * Create deal - confirm and execute
 */
class CreateDealConfirmNode extends MenuNode {
  constructor() {
    super('CREATE_DEAL_CONFIRM');
  }

  async render(session) {
    const deal = session.context.newDeal;

    return this.con(
      `Confirm New Deal:\n` +
      `Receiver: ${deal.receiverPhone}\n` +
      `Driver: ${deal.driverPhone}\n` +
      `Amount: ${deal.amount} RWF\n\n` +
      `1. Confirm\n` +
      `2. Cancel`
    );
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const choice = input.trim();

    // Check if it's confirmation choice (1 or 2)
    if (isValidChoice(choice, 1, 2)) {
      const choiceNum = parseInt(choice);

      if (choiceNum === 2) {
        // Cancel - clear and go back to main menu
        sessionStore.clearContext(session.sessionId);
        return {
          nextNode: 'MAIN_MENU',
          message: this.con('Deal creation cancelled.\n\nMain Menu:\n1. My Shipments\n2. My Deliveries\n3. My Purchases\n4. Create New Deal'),
        };
      }

      // Choice 1 - ask for PIN
      return {
        nextNode: 'CREATE_DEAL_CONFIRM',
        message: this.con('Enter your 4-digit PIN to create deal:'),
      };
    }

    // Assume it's PIN input
    const pin = choice;

    if (!isValidPin(pin)) {
      return {
        nextNode: 'CREATE_DEAL_CONFIRM',
        message: this.con('Invalid PIN.\nEnter your 4-digit PIN:'),
      };
    }

    // Execute deal creation
    const deal = session.context.newDeal;
    const senderPhone = session.phoneNumber;

    try {
      const result = await backendClient.createDeal(
        senderPhone,
        deal.driverPhone,
        deal.receiverPhone,
        deal.amount,
        pin
      );

      if (result.success) {
        // Clear context
        sessionStore.clearContext(session.sessionId);

        return {
          nextNode: null,
          message: this.end(
            `Deal created successfully!\n` +
            `Deal ID: ${result.data.dealId}\n` +
            `Receiver has 24 hours to lock funds.\n` +
            `All parties notified via SMS.`
          ),
        };
      } else {
        const errorMsg = result.error || 'Deal creation failed';

        // Check for PIN errors
        if (errorMsg.includes('PIN') || errorMsg.includes('locked')) {
          return {
            nextNode: 'CREATE_DEAL_CONFIRM',
            message: this.con(`${errorMsg}\nEnter PIN:`),
          };
        }

        // Other errors
        return {
          nextNode: null,
          message: this.end(`Error: ${errorMsg}`),
        };
      }
    } catch (error) {
      console.error('Deal creation error:', error.message);
      return {
        nextNode: null,
        message: this.end('System error. Please try again later.'),
      };
    }
  }
}

module.exports = CreateDealConfirmNode;
