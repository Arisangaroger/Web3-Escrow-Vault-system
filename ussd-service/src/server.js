require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SessionStore = require('./session/SessionStore');
const BackendClient = require('./client/BackendClient');
const createMenuRegistry = require('./menus');
const { normalizePhoneNumber, isValidPhoneNumber, redactUssdText } = require('./utils/validators');
const log = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4000;
const DEBUG_SESSIONS =
  process.env.ENABLE_DEBUG_SESSIONS === 'true' ||
  process.env.NODE_ENV === 'development';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionStore = new SessionStore(
  parseInt(process.env.SESSION_TIMEOUT_SECONDS) || 90,
  parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS) || 60000
);

const backendClient = new BackendClient(
  process.env.BACKEND_API_URL || 'http://localhost:3000'
);

const menuRegistry = createMenuRegistry();

log.info('Registered menu nodes', { count: menuRegistry.getNodeIds().length });

/**
 * Main USSD endpoint - implements CON/END protocol
 */
app.post('/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber: rawPhone, text } = req.body;

    if (!sessionId || !rawPhone) {
      return res.send('END Invalid request format.');
    }

    if (!isValidPhoneNumber(rawPhone)) {
      return res.send('END Invalid phone number. Use format 0788123456.');
    }

    const phoneNumber = normalizePhoneNumber(rawPhone);

    log.info('USSD request', {
      phoneNumber,
      rawPhone: String(rawPhone).trim(),
      sessionId,
      input: redactUssdText(text),
    });

    let session = sessionStore.getSession(sessionId);

    if (!session) {
      if (text && text.length > 0) {
        return res.send('END Session expired. Please dial again.');
      }

      session = sessionStore.createSession(sessionId, phoneNumber);

      try {
        const pinStatus = await backendClient.getPinStatus(phoneNumber);

        if (pinStatus.success && pinStatus.data?.hasPin) {
          session.currentNode = 'PIN_LOGIN';
        } else if (pinStatus.success) {
          session.currentNode = 'PIN_SETUP';
        } else {
          return res.send('END System error. Please try again.');
        }
      } catch (error) {
        log.error('PIN status check failed', error, { phoneNumber, sessionId });
        session.currentNode = 'PIN_SETUP';
      }
    }

    sessionStore.touchSession(sessionId);

    const nodeId = session.currentNode;

    if (!menuRegistry.hasNode(nodeId)) {
      log.error('Unknown menu node', { nodeId, sessionId, phoneNumber });
      return res.send('END System error.');
    }

    const node = menuRegistry.getNode(nodeId);

    const inputParts = text ? text.split('*') : [];
    const userInput = inputParts.length > 0 ? inputParts[inputParts.length - 1] : '';

    if (inputParts.length === 0 || (inputParts.length === 1 && !inputParts[0])) {
      const message = await node.render(session, backendClient);
      return res.send(message);
    }

    const result = await node.handleInput(
      userInput,
      session,
      sessionStore,
      backendClient
    );

    if (result.nextNode) {
      sessionStore.updateSession(sessionId, {
        currentNode: result.nextNode,
      });

      if (result.message) {
        return res.send(result.message);
      }

      const nextNode = menuRegistry.getNode(result.nextNode);
      const message = await nextNode.render(
        sessionStore.getSession(sessionId) || session,
        backendClient
      );
      return res.send(message);
    }

    sessionStore.deleteSession(sessionId);
    return res.send(result.message || 'END Thank you.');
  } catch (error) {
    log.error('USSD handler error', error);
    return res.send('END System error. Please try again later.');
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    sessions: sessionStore.getSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/sessions/:sessionId', (req, res) => {
  if (!DEBUG_SESSIONS) {
    return res.status(404).json({ error: 'Not found' });
  }

  const session = sessionStore.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const safe = {
    ...session,
    context: { ...(session.context || {}) },
  };
  delete safe.context.pendingPin;

  res.json(safe);
});

app.get('/notifications/:phone', async (req, res) => {
  try {
    const phone = normalizePhoneNumber(req.params.phone);
    const result = await backendClient.getNotifications(phone);
    res.json(result);
  } catch (error) {
    log.error('Notifications fetch failed', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  log.info('USSD Service started', {
    port: PORT,
    shortcode: process.env.USSD_SHORTCODE || '*384*96#',
    sessionTimeoutSeconds: process.env.SESSION_TIMEOUT_SECONDS || 90,
    backendApi: process.env.BACKEND_API_URL || 'http://localhost:3000',
  });
});
