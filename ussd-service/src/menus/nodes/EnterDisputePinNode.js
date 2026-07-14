const log = require('../../utils/logger');
const MenuNode = require('../MenuNode');
const { isValidPin } = require('../../utils/validators');
const { getDisputeReasonText } = require('../../utils/menuHelpers');

/**
 * PIN entry for dispute/revoke — verify PIN then async submit
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
      const verified = await backendClient.verifyPin(phoneNumber, pin);
      if (!verified.success) {
        const errorMsg = verified.error || 'Incorrect PIN';
        if (errorMsg.toLowerCase().includes('locked')) {
          return { nextNode: null, message: this.end(errorMsg) };
        }
        return {
          nextNode: 'ENTER_DISPUTE_PIN',
          message: this.con(`${errorMsg}\nEnter PIN:`),
        };
      }

      const reasonText = getDisputeReasonText(reasonCode);

      backendClient
        .revokeDeal(phoneNumber, dealId, reasonCode, pin)
        .then((result) => {
          if (!result?.success) {
            log.error('Background revoke failed', { error: result?.error || result });
          }
        })
        .catch((error) => {
          log.error('Menu error', error);
        });

      sessionStore.clearContext(session.sessionId);

      return {
        nextNode: null,
        message: this.end(
          `Dispute submitted.\nReason: ${reasonText}\nProcessing...\nYou will receive SMS when complete.`
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

module.exports = EnterDisputePinNode;
