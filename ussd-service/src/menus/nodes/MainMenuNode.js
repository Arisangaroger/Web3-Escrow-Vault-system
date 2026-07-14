const log = require('../../utils/logger');
const MenuNode = require('../MenuNode');
const { isValidChoice } = require('../../utils/validators');

/**
 * Main menu - entry point for authenticated users
 */
class MainMenuNode extends MenuNode {
  constructor() {
    super('MAIN_MENU');
  }

  async render(session, backendClient) {
    // Optionally fetch deal counts for display
    try {
      const dealsResponse = await backendClient.getActiveDeals(session.phoneNumber);
      
      if (dealsResponse.success) {
        const deals = dealsResponse.data;
        const sellerCount = deals.asSeller?.length || 0;
        const driverCount = deals.asDriver?.length || 0;
        const buyerCount = deals.asBuyer?.length || 0;

        return this.con(
          `Escrow Main Menu:\n` +
          `1. My Shipments (${sellerCount})\n` +
          `2. My Deliveries (${driverCount})\n` +
          `3. My Purchases (${buyerCount})\n` +
          `4. Create New Deal`
        );
      }
    } catch (error) {
      log.error('Menu error', error);
    }

    // Fallback without counts
    return this.con(
      'Escrow Main Menu:\n' +
      '1. My Shipments (Seller)\n' +
      '2. My Deliveries (Driver)\n' +
      '3. My Purchases (Buyer)\n' +
      '4. Create New Deal'
    );
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const choice = input.trim();

    if (!isValidChoice(choice, 1, 4)) {
      return {
        nextNode: 'MAIN_MENU',
        message: this.con('Invalid choice.\n\nEscrow Main Menu:\n1. My Shipments\n2. My Deliveries\n3. My Purchases\n4. Create New Deal'),
      };
    }

    const choiceNum = parseInt(choice);

    // Map choice to role category
    const roleMap = {
      1: 'asSeller',
      2: 'asDriver',
      3: 'asBuyer',
    };

    if (choiceNum === 4) {
      // Create new deal
      return {
        nextNode: 'CREATE_DEAL_RECEIVER',
        message: this.con('Create New Deal\nEnter Receiver phone:'),
      };
    }

    // Store selected role category
    sessionStore.updateContext(session.sessionId, {
      selectedCategory: roleMap[choiceNum],
    });

    return {
      nextNode: 'DEAL_LIST',
      message: null, // Will be rendered by next node
    };
  }
}

module.exports = MainMenuNode;
