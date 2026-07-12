const MenuNode = require('../MenuNode');
const { isValidChoice } = require('../../utils/validators');

/**
 * Dispute reason selection
 */
class DisputeReasonNode extends MenuNode {
  constructor() {
    super('DISPUTE_REASON');
  }

  async render(session) {
    return this.con(
      'Select Dispute Reason:\n' +
      '1. Goods not received\n' +
      '2. Wrong items delivered\n' +
      '3. Damaged goods\n' +
      '4. Quantity mismatch\n' +
      '5. Other\n' +
      '0. Cancel'
    );
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const choice = input.trim();

    if (!isValidChoice(choice, 0, 5)) {
      return {
        nextNode: 'DISPUTE_REASON',
        message: this.con('Invalid choice.\nSelect reason (1-5) or 0 to cancel:'),
      };
    }

    const choiceNum = parseInt(choice);

    if (choiceNum === 0) {
      // Cancel - back to deal actions
      return {
        nextNode: 'DEAL_ACTIONS',
        message: null,
      };
    }

    // Store reason code
    sessionStore.updateContext(session.sessionId, {
      disputeReasonCode: choiceNum,
    });

    // Go to PIN entry for revoke action
    return {
      nextNode: 'ENTER_DISPUTE_PIN',
      message: this.con('Enter your 4-digit PIN to confirm dispute:'),
    };
  }
}

module.exports = DisputeReasonNode;
