const log = require('../../utils/logger');
const MenuNode = require('../MenuNode');
const { isValidChoice, isNumeric } = require('../../utils/validators');
const { getAvailableActions } = require('../../utils/menuHelpers');

/**
 * Display available actions for selected deal based on role and status
 */
class DealActionsNode extends MenuNode {
  constructor() {
    super('DEAL_ACTIONS');
  }

  async render(session, backendClient) {
    const dealId = session.context.selectedDealId;

    try {
      const response = await backendClient.getDealDetails(dealId);

      if (!response.success) {
        return this.con('Error loading deal.\n0. Back');
      }

      const deal = response.data;

      // Determine user's role in this deal
      let role = null;
      if (deal.senderPhone === session.phoneNumber) role = 'sender';
      else if (deal.driverPhone === session.phoneNumber) role = 'driver';
      else if (deal.receiverPhone === session.phoneNumber) role = 'receiver';

      if (!role) {
        return this.con('You are not part of this deal.\n0. Back');
      }

      // Get available actions
      const actions = getAvailableActions(role, deal.status);

      if (actions.length === 0) {
        return this.con(`Deal #${dealId}\nStatus: ${deal.status}\nNo actions available.\n0. Back`);
      }

      // Build menu
      let menu = `Deal #${dealId} (${deal.amount} RWF)\nStatus: ${deal.status}\n\n`;

      actions.forEach((action, index) => {
        menu += `${index + 1}. ${action.label}\n`;
      });

      menu += '0. Back';

      // Store actions in context for selection
      session.context.availableActions = actions;
      session.context.currentDeal = deal;
      session.context.userRole = role;

      return this.con(menu);
    } catch (error) {
      log.error('Menu error', error);
      return this.con('System error.\n0. Back');
    }
  }

  async handleInput(input, session, sessionStore, backendClient) {
    const choice = input.trim();

    if (!isNumeric(choice)) {
      return {
        nextNode: 'DEAL_ACTIONS',
        message: this.con('Invalid input. Enter a number.'),
      };
    }

    const choiceNum = parseInt(choice);

    // Back to deal list
    if (choiceNum === 0) {
      sessionStore.updateContext(session.sessionId, {
        selectedDealId: undefined,
        availableActions: undefined,
        currentDeal: undefined,
        userRole: undefined,
      });
      return {
        nextNode: 'DEAL_LIST',
        message: null,
      };
    }

    const actions = session.context.availableActions || [];

    if (choiceNum < 1 || choiceNum > actions.length) {
      return {
        nextNode: 'DEAL_ACTIONS',
        message: this.con(`Invalid choice. Select 1-${actions.length} or 0.`),
      };
    }

    const selectedAction = actions[choiceNum - 1];

    // Store selected action
    sessionStore.updateContext(session.sessionId, {
      pendingAction: selectedAction.id,
    });

    // Route based on action
    switch (selectedAction.id) {
      case 'VIEW_STATUS':
        return {
          nextNode: 'VIEW_STATUS',
          message: null,
        };

      case 'REVOKE':
        // Go to dispute reason selection
        return {
          nextNode: 'DISPUTE_REASON',
          message: null,
        };

      default:
        // All other actions need confirmation
        if (selectedAction.requiresPin) {
          return {
            nextNode: 'CONFIRM_ACTION',
            message: null,
          };
        } else {
          return {
            nextNode: 'DEAL_ACTIONS',
            message: this.con('Action not available.'),
          };
        }
    }
  }
}

module.exports = DealActionsNode;
