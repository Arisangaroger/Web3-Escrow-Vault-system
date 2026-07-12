const MenuNode = require('../MenuNode');
const { isValidPhoneNumber, normalizePhoneNumber } = require('../../utils/validators');

/**
 * Create deal - enter receiver phone
 */
class CreateDealReceiverNode extends MenuNode {
  constructor() {
    super('CREATE_DEAL_RECEIVER');
  }

  async render(session) {
    return this.con('Create New Deal\nEnter Receiver (Buyer) phone:\n(Format: +250788123456)');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const phone = input.trim();

    if (!isValidPhoneNumber(phone)) {
      return {
        nextNode: 'CREATE_DEAL_RECEIVER',
        message: this.con('Invalid phone number.\nEnter Receiver phone:\n(+250788123456)'),
      };
    }

    const normalized = normalizePhoneNumber(phone);

    // Check not same as sender
    if (normalized === session.phoneNumber) {
      return {
        nextNode: 'CREATE_DEAL_RECEIVER',
        message: this.con('Cannot create deal with yourself.\nEnter Receiver phone:'),
      };
    }

    // Store receiver phone
    sessionStore.updateContext(session.sessionId, {
      newDeal: {
        receiverPhone: normalized,
      },
    });

    return {
      nextNode: 'CREATE_DEAL_DRIVER',
      message: this.con('Enter Driver phone:\n(+250788123456)'),
    };
  }
}

module.exports = CreateDealReceiverNode;
