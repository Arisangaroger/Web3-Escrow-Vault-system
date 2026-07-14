const log = require('../../utils/logger');
const MenuNode = require('../MenuNode');
const { isValidChoice, isValidPin, formatPhoneForDisplay } = require('../../utils/validators');

/**
 * Create deal - confirm and execute (async after PIN verify)
 */
class CreateDealConfirmNode extends MenuNode {
  constructor() {
    super('CREATE_DEAL_CONFIRM');
  }

  async render(session) {
    const deal = session.context.newDeal;

    return this.con(
      `Confirm New Deal:\n` +
        `Receiver: ${formatPhoneForDisplay(deal.receiverPhone)}\n` +
        `Driver: ${formatPhoneForDisplay(deal.driverPhone)}\n` +
        `Amount: ${deal.amount} RWF\n\n` +
        `1. Confirm\n` +
        `2. Cancel`
    );
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const choice = input.trim();

    if (isValidChoice(choice, 1, 2)) {
      const choiceNum = parseInt(choice);

      if (choiceNum === 2) {
        sessionStore.clearContext(session.sessionId);
        return {
          nextNode: 'MAIN_MENU',
          message: this.con(
            'Deal creation cancelled.\n\nMain Menu:\n1. My Shipments\n2. My Deliveries\n3. My Purchases\n4. Create New Deal'
          ),
        };
      }

      return {
        nextNode: 'CREATE_DEAL_CONFIRM',
        message: this.con('Enter your 4-digit PIN to create deal:'),
      };
    }

    const pin = choice;

    if (!isValidPin(pin)) {
      return {
        nextNode: 'CREATE_DEAL_CONFIRM',
        message: this.con('Invalid PIN.\nEnter your 4-digit PIN:'),
      };
    }

    const deal = session.context.newDeal;
    const senderPhone = session.phoneNumber;

    try {
      const verified = await backendClient.verifyPin(senderPhone, pin);
      if (!verified.success) {
        const errorMsg = verified.error || 'Incorrect PIN';
        if (errorMsg.toLowerCase().includes('locked')) {
          return { nextNode: null, message: this.end(errorMsg) };
        }
        return {
          nextNode: 'CREATE_DEAL_CONFIRM',
          message: this.con(`${errorMsg}\nEnter PIN:`),
        };
      }

      backendClient
        .createDeal(
          senderPhone,
          deal.driverPhone,
          deal.receiverPhone,
          deal.amount,
          pin
        )
        .then((result) => {
          if (!result?.success) {
            log.error('Background createDeal failed', { error: result?.error || result });
          }
        })
        .catch((error) => {
          log.error('Menu error', error);
        });

      sessionStore.clearContext(session.sessionId);

      return {
        nextNode: null,
        message: this.end(
          'Processing deal creation...\nYou will receive an SMS when complete.\nReceiver will have 24 hours to lock funds.'
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

module.exports = CreateDealConfirmNode;
