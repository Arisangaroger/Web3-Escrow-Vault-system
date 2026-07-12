const MenuNode = require('../MenuNode');
const { isValidChoice, isNumeric } = require('../../utils/validators');

/**
 * Display list of deals for selected role category
 */
class DealListNode extends MenuNode {
  constructor() {
    super('DEAL_LIST');
  }

  async render(session, backendClient) {
    const category = session.context.selectedCategory;
    
    try {
      const response = await backendClient.getActiveDeals(session.phoneNumber);
      
      if (!response.success) {
        return this.con(`Error loading deals.\n0. Back to Main Menu`);
      }

      const deals = response.data[category] || [];

      if (deals.length === 0) {
        const categoryNames = {
          asSeller: 'Shipments',
          asDriver: 'Deliveries',
          asBuyer: 'Purchases',
        };
        return this.con(`No active ${categoryNames[category]}.\n0. Back to Main Menu`);
      }

      // Build menu
      let menu = `My ${category === 'asSeller' ? 'Shipments' : category === 'asDriver' ? 'Deliveries' : 'Purchases'}:\n`;
      
      deals.forEach((deal, index) => {
        menu += `${index + 1}. Deal #${deal.dealId} - ${deal.amount} RWF (${deal.status})\n`;
      });
      
      menu += '0. Back';

      // Store deals list in context for selection
      session.context.dealsList = deals;

      return this.con(menu);
    } catch (error) {
      console.error('Error fetching deals:', error.message);
      return this.con('System error loading deals.\n0. Back to Main Menu');
    }
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const choice = input.trim();

    if (!isNumeric(choice)) {
      return {
        nextNode: 'DEAL_LIST',
        message: this.con('Invalid input. Enter a number.\n0. Back'),
      };
    }

    const choiceNum = parseInt(choice);

    // Back to main menu
    if (choiceNum === 0) {
      sessionStore.clearContext(session.sessionId);
      return {
        nextNode: 'MAIN_MENU',
        message: null,
      };
    }

    const deals = session.context.dealsList || [];
    
    if (choiceNum < 1 || choiceNum > deals.length) {
      return {
        nextNode: 'DEAL_LIST',
        message: this.con(`Invalid choice. Select 1-${deals.length} or 0.\n0. Back`),
      };
    }

    // Store selected deal
    const selectedDeal = deals[choiceNum - 1];
    sessionStore.updateContext(session.sessionId, {
      selectedDealId: selectedDeal.dealId,
    });

    return {
      nextNode: 'DEAL_ACTIONS',
      message: null, // Will be rendered by next node
    };
  }
}

module.exports = DealListNode;
