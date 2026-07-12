/**
 * Helper functions for menu rendering and navigation
 */

/**
 * Get available actions based on user's role and deal status
 */
function getAvailableActions(role, status) {
  const actions = {
    // Receiver actions
    receiver: {
      Created: [
        { id: 'LOCK_FUNDS', label: 'Lock Funds', requiresPin: true },
        { id: 'CANCEL', label: 'Cancel Deal', requiresPin: true },
      ],
      FundsLocked: [
        { id: 'REVOKE', label: 'Dispute Deal', requiresPin: true },
        { id: 'VIEW_STATUS', label: 'View Status', requiresPin: false },
      ],
      Shipped: [
        { id: 'REVOKE', label: 'Dispute Deal', requiresPin: true },
        { id: 'VIEW_STATUS', label: 'View Status', requiresPin: false },
      ],
      Delivered: [
        { id: 'REVOKE', label: 'Dispute (Goods Not Received)', requiresPin: true },
        { id: 'VIEW_STATUS', label: 'Wait for Auto-Release', requiresPin: false },
      ],
      Disputed: [
        { id: 'VIEW_STATUS', label: 'View Status (Under Review)', requiresPin: false },
      ],
      Released: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
      Cancelled: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
      Resolved: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
    },

    // Sender actions
    sender: {
      Created: [
        { id: 'CANCEL', label: 'Cancel Deal', requiresPin: true },
        { id: 'VIEW_STATUS', label: 'View Status', requiresPin: false },
      ],
      FundsLocked: [
        { id: 'MARK_SHIPPED', label: 'Mark as Shipped', requiresPin: true },
        { id: 'REVOKE', label: 'Dispute Deal', requiresPin: true },
      ],
      Shipped: [
        { id: 'REVOKE', label: 'Dispute Deal', requiresPin: true },
        { id: 'VIEW_STATUS', label: 'View Status', requiresPin: false },
      ],
      Delivered: [
        { id: 'VIEW_STATUS', label: 'Wait for Auto-Release', requiresPin: false },
      ],
      Disputed: [
        { id: 'VIEW_STATUS', label: 'View Status (Under Review)', requiresPin: false },
      ],
      Released: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
      Cancelled: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
      Resolved: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
    },

    // Driver actions
    driver: {
      Created: [
        { id: 'VIEW_STATUS', label: 'View Status (Awaiting Funds)', requiresPin: false },
      ],
      FundsLocked: [
        { id: 'VIEW_STATUS', label: 'View Status (Awaiting Shipment)', requiresPin: false },
      ],
      Shipped: [
        { id: 'MARK_DELIVERED', label: 'Mark as Delivered', requiresPin: true },
        { id: 'VIEW_STATUS', label: 'View Status', requiresPin: false },
      ],
      Delivered: [
        { id: 'VIEW_STATUS', label: 'View Status (Awaiting Release)', requiresPin: false },
      ],
      Disputed: [
        { id: 'VIEW_STATUS', label: 'View Status (Under Review)', requiresPin: false },
      ],
      Released: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
      Cancelled: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
      Resolved: [
        { id: 'VIEW_STATUS', label: 'View Summary', requiresPin: false },
      ],
    },
  };

  return actions[role]?.[status] || [];
}

/**
 * Format deal summary for display
 */
function formatDealSummary(deal, currentUserPhone) {
  const lines = [];
  
  // Determine user's role
  let role = 'unknown';
  if (deal.senderPhone === currentUserPhone) role = 'Seller';
  else if (deal.driverPhone === currentUserPhone) role = 'Driver';
  else if (deal.receiverPhone === currentUserPhone) role = 'Buyer';

  lines.push(`Deal #${deal.dealId}`);
  lines.push(`Amount: ${deal.amount} RWF`);
  lines.push(`Status: ${deal.status}`);
  lines.push(`Your Role: ${role}`);
  lines.push(`Created: ${new Date(deal.createdAt).toLocaleDateString()}`);

  return lines.join('\n');
}

/**
 * Truncate text to fit USSD screen limits (~160 chars)
 */
function truncateForUSSD(text, maxLength = 160) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get dispute reason text by code
 */
function getDisputeReasonText(reasonCode) {
  const reasons = {
    1: 'Goods not received',
    2: 'Wrong items delivered',
    3: 'Damaged goods',
    4: 'Quantity mismatch',
    5: 'Other',
  };
  return reasons[reasonCode] || 'Unknown reason';
}

module.exports = {
  getAvailableActions,
  formatDealSummary,
  truncateForUSSD,
  getDisputeReasonText,
};
