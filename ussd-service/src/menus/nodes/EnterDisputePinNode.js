const MenuNode = require('../MenuNode');
const { isValidPin } = require('../../utils/validators');
const { getDisputeReasonText } = require('../../utils/menuHelpers');

/**
 * PIN entry for dispute/revoke action
 */
class EnterDisputePinNode extends MenuNode {
  constructor() {
    super('ENTER_DISPUTE_PIN');
  }

  async render(session) {
    return this.con('Enter your 4-digit PIN to confirm dispute:');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const pin = input.trim();

    if (!isValidPin(pin)) {
      return {
        nextNode: 'ENTER_DISPUTE_PIN',
        message: this.con('Invalid PIN format.\nEnter your 4-digit PIN:'),
      };
    }

    const dealId = session.context.selectedDealId;
    const reasonCode = session.context.disputeReasonCode;
    const phoneNumber = session.phoneNumber;

    try {
      const result = await backendClient.revokeDeal(phoneNumber, dealId, reasonCode, pin);

      if (result.success) {
        // Clear context
        sessionStore.clearContext(session.sessionId);

        const reasonText = getDisputeReasonText(reasonCode);

        return {
          nextNode: null,
          message: this.end(
            `Dispute filed successfully!\n` +
            `Reason: ${reasonText}\n` +
            `All parties and admin notified.\n` +
            `Deal frozen pending review.`
          ),
        };
      } else {
        const errorMsg = result.error || 'Dispute failed';

        // Check for PIN errors
        if (errorMsg.includes('PIN') || errorMsg.includes('locked')) {
          return {
            nextNode: 'ENTER_DISPUTE_PIN',
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
      console.error('Dispute error:', error.message);
      return {
        nextNode: null,
        message: this.end('System error. Please try again later.'),
      };
    }
  }
}

module.exports = EnterDisputePinNode;
