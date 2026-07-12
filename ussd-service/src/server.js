require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SessionStore = require('./session/SessionStore');
const BackendClient = require('./client/BackendClient');
const createMenuRegistry = require('./menus');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize components
const sessionStore = new SessionStore(
  parseInt(process.env.SESSION_TIMEOUT_SECONDS) || 30,
  parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS) || 60000
);

const backendClient = new BackendClient(
  process.env.BACKEND_API_URL || 'http://localhost:3000'
);

const menuRegistry = createMenuRegistry();

console.log(`✅ Registered ${menuRegistry.getNodeIds().length} menu nodes`);

/**
 * Main USSD endpoint - implements CON/END protocol
 */
app.post('/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;

    // Validate request
    if (!sessionId || !phoneNumber) {
      return res.send('END Invalid request format.');
    }

    console.log(`📱 USSD Request: ${phoneNumber} | Session: ${sessionId} | Input: "${text}"`);

    // Get or create session
    let session = sessionStore.getSession(sessionId);

    if (!session) {
      // Check if session expired
      if (text && text.length > 0) {
        return res.send('END Session expired. Please dial again.');
      }

      // New session - create it
      session = sessionStore.createSession(sessionId, phoneNumber);

      // Check if user needs PIN setup
      try {
        const dealsResponse = await backendClient.getActiveDeals(phoneNumber);
        
        if (dealsResponse.success) {
          // User exists - go to main menu
          session.currentNode = 'MAIN_MENU';
        } else if (dealsResponse.error && dealsResponse.error.includes('not found')) {
          // New user - PIN setup
          session.currentNode = 'PIN_SETUP';
        } else {
          // Other error
          return res.send('END System error. Please try again.');
        }
      } catch (error) {
        console.error('User check error:', error.message);
        // Assume new user if backend unreachable
        session.currentNode = 'PIN_SETUP';
      }
    }

    // Update session activity
    sessionStore.touchSession(sessionId);

    // Get current node
    const nodeId = session.currentNode;
    
    if (!menuRegistry.hasNode(nodeId)) {
      console.error(`Unknown node: ${nodeId}`);
      return res.send('END System error.');
    }

    const node = menuRegistry.getNode(nodeId);

    // Parse user input (last part after *)
    const inputParts = text ? text.split('*') : [];
    const userInput = inputParts.length > 0 ? inputParts[inputParts.length - 1] : '';

    // If no input yet (first screen), render current node
    if (inputParts.length === 0 || (inputParts.length === 1 && !inputParts[0])) {
      const message = await node.render(session, backendClient);
      return res.send(message);
    }

    // Process user input
    const result = await node.handleInput(
      userInput,
      session,
      sessionStore,
      backendClient
    );

    // Handle navigation
    if (result.nextNode) {
      // Update session node
      sessionStore.updateSession(sessionId, {
        currentNode: result.nextNode,
      });

      // Render next node or use provided message
      if (result.message) {
        return res.send(result.message);
      } else {
        const nextNode = menuRegistry.getNode(result.nextNode);
        const message = await nextNode.render(session, backendClient);
        return res.send(message);
      }
    } else {
      // Session ends (result.message should be END message)
      sessionStore.deleteSession(sessionId);
      return res.send(result.message || 'END Thank you.');
    }
  } catch (error) {
    console.error('USSD handler error:', error);
    return res.send('END System error. Please try again later.');
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    sessions: sessionStore.getSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Get session info (for debugging)
 */
app.get('/sessions/:sessionId', (req, res) => {
  const session = sessionStore.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }
  res.json(session);
});

/**
 * Get notifications for a phone number (for simulator SMS inbox)
 */
app.get('/notifications/:phone', async (req, res) => {
  try {
    const result = await backendClient.getNotifications(req.params.phone);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 USSD Service running on port ${PORT}`);
  console.log(`📞 USSD Shortcode: ${process.env.USSD_SHORTCODE || '*384*96#'}`);
  console.log(`⏱️  Session timeout: ${process.env.SESSION_TIMEOUT_SECONDS || 30}s`);
  console.log(`🔗 Backend API: ${process.env.BACKEND_API_URL || 'http://localhost:3000'}`);
});
