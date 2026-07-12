const MenuNode = require('../MenuNode');
const { isValidPhoneNumber, normalizePhoneNumber } = require('../../utils/validators');

/**
 * Create deal - enter driver phone
 */
class CreateDealDriverNode extends MenuNode {
  constructor() {
    super('CREATE_DEAL_DRIVER');
  }

  async render(session) {
    return this.con('Enter Driver phone:\n(+250788123456)');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const phone = input.trim();

    if (!isValidPhoneNumber(phone)) {
      return {
        nextNode: 'CREATE_DEAL_DRIVER',
        message: this.con('Invalid phone number.\nEnter Driver phone:\n(+250788123456)'),
      };
    }

    const normalized = normalizePhoneNumber(phone);
    const receiverPhone = session.context.newDeal.receiverPhone;

    // Check not same as sender
    if (normalized === session.phoneNumber) {
      return {
        nextNode: 'CREATE_DEAL_DRIVER',
        message: this.con('Cannot be your own driver.\nEnter Driver phone:'),
      };
    }

    // Check not same as receiver
    if (normalized === receiverPhone) {
      return {
        nextNode: 'CREATE_DEAL_DRIVER',
        message: this.con('Driver cannot be same as receiver.\nEnter Driver phone:'),
      };
    }

    // Store driver phone
    sessionStore.updateContext(session.sessionId, {
      newDeal: {
        ...session.context.newDeal,
        driverPhone: normalized,
      },
    });

    return {
      nextNode: 'CREATE_DEAL_AMOUNT',
      message: this.con('Enter Deal Amount (RWF):'),
    };
  }
}

module.exports = CreateDealDriverNode;
