const MenuNode = require('../MenuNode');
const { formatDealSummary } = require('../../utils/menuHelpers');

/**
 * View deal status/summary
 */
class ViewStatusNode extends MenuNode {
  constructor() {
    super('VIEW_STATUS');
  }

  async render(session, backendClient) {
    const deal = session.context.currentDeal;

    if (!deal) {
      return this.end('Error: Deal not found.');
    }

    const summary = formatDealSummary(deal, session.phoneNumber);

    return this.end(summary);
  }

  async handleInput(input, session, sessionStore, backendClient) {
    // This node always ends session after display
    return {
      nextNode: null,
      message: this.end('Session ended.'),
    };
  }
}

module.exports = ViewStatusNode;
