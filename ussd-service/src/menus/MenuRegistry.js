/**
 * Central registry for all menu nodes
 * Maps node IDs to node instances for navigation
 */
class MenuRegistry {
  constructor() {
    this.nodes = new Map();
  }

  /**
   * Register a menu node
   */
  register(node) {
    this.nodes.set(node.id, node);
  }

  /**
   * Get node by ID
   */
  getNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Menu node not found: ${nodeId}`);
    }
    return node;
  }

  /**
   * Check if node exists
   */
  hasNode(nodeId) {
    return this.nodes.has(nodeId);
  }

  /**
   * Get all registered node IDs
   */
  getNodeIds() {
    return Array.from(this.nodes.keys());
  }
}

module.exports = MenuRegistry;
