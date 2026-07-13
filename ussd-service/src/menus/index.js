/**
 * Initialize and export menu registry with all nodes registered
 */
const MenuRegistry = require('./MenuRegistry');

// Import all menu nodes
const PinSetupNode = require('./nodes/PinSetupNode');
const PinConfirmNode = require('./nodes/PinConfirmNode');
const PinLoginNode = require('./nodes/PinLoginNode');
const MainMenuNode = require('./nodes/MainMenuNode');
const DealListNode = require('./nodes/DealListNode');
const DealActionsNode = require('./nodes/DealActionsNode');
const ConfirmActionNode = require('./nodes/ConfirmActionNode');
const EnterPinNode = require('./nodes/EnterPinNode');
const DisputeReasonNode = require('./nodes/DisputeReasonNode');
const EnterDisputePinNode = require('./nodes/EnterDisputePinNode');
const CreateDealReceiverNode = require('./nodes/CreateDealReceiverNode');
const CreateDealDriverNode = require('./nodes/CreateDealDriverNode');
const CreateDealAmountNode = require('./nodes/CreateDealAmountNode');
const CreateDealConfirmNode = require('./nodes/CreateDealConfirmNode');
const ViewStatusNode = require('./nodes/ViewStatusNode');

/**
 * Create and initialize menu registry
 */
function createMenuRegistry() {
  const registry = new MenuRegistry();

  // Register all nodes
  registry.register(new PinSetupNode());
  registry.register(new PinConfirmNode());
  registry.register(new PinLoginNode());
  registry.register(new MainMenuNode());
  registry.register(new DealListNode());
  registry.register(new DealActionsNode());
  registry.register(new ConfirmActionNode());
  registry.register(new EnterPinNode());
  registry.register(new DisputeReasonNode());
  registry.register(new EnterDisputePinNode());
  registry.register(new CreateDealReceiverNode());
  registry.register(new CreateDealDriverNode());
  registry.register(new CreateDealAmountNode());
  registry.register(new CreateDealConfirmNode());
  registry.register(new ViewStatusNode());

  return registry;
}

module.exports = createMenuRegistry;
