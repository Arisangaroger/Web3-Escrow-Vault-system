# USSD Service - Phase 3

USSD simulation layer for the Agricultural Escrow Platform. Provides a feature-phone interface for users to interact with the escrow system via simulated USSD menus.

**Status:** local-demo capable when backend is up — **not** production-ready. See `PHASE3_COMPLETE.md` for gaps.

## Quick Start

### Prerequisites
- Node.js 16+
- Phase 2 backend running on port 3000
- PostgreSQL with Phase 2 schema

### Installation

```bash
cd ussd-service
npm install
```

### Configuration

```bash
cp .env.example .env
# Edit .env if needed (defaults should work)
```

### Start Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Server runs on `http://localhost:4000`

### Open Simulator

Open `simulator-ui/index.html` in your browser. You'll see 3 simulated phones ready to use.

## Usage

### Simulator Interface

1. **Enter phone number** in the header (e.g., `0788111111`)
2. **Click "Dial"** to start a USSD session
3. **Enter digits** in the input field
4. **Click "Send"** or press Enter
5. **Watch SMS inbox** for notifications

### Complete Deal Flow (3 Phones)

**Phone 1 (Sender: 0788111111) - First Time User:**
1. Dial → Create Account (Set PIN: 1111)
2. Confirm PIN: 1111
3. Main Menu → 4 (Create Deal)
4. Enter receiver: `0788333333`
5. Enter driver: `0788222222`
6. Enter amount: `1000`
7. Confirm → PIN

**Phone 3 (Receiver: 0788333333) - First Time User:**
1. Dial → Create Account (Set PIN: 3333)
2. Confirm PIN: 3333
3. Main Menu → 3 (My Purchases)
4. Select deal
5. Lock Funds → PIN

**Phone 1 (Sender) - Returning User:**
1. Dial → Enter PIN: 1111
2. Main Menu → 1 (My Shipments)
3. Select deal
4. Mark Shipped → PIN

**Phone 2 (Driver: 0788222222) - First Time User:**
1. Dial → Create Account (Set PIN: 2222)
2. Confirm PIN: 2222
3. Main Menu → 2 (My Deliveries)
4. Select deal
5. Mark Delivered → PIN

**All phones receive triangular broadcast SMS**

Wait 3 hours (or use keeper) → Auto-release

## Architecture

```
Simulator UI (Browser)
    ↓ HTTP POST
USSD Server (:4000)
    ├─ Session Store (in-memory)
    ├─ Menu Registry (14 nodes)
    └─ Backend Client
         ↓ HTTP
Backend API (:3000)
    ↓
Blockchain
```

### Key Components

#### 1. Session Store
- In-memory session management
- 90-second timeout (configurable) - allows time for phone number entry
- Automatic cleanup

#### 2. Menu Nodes (15 total)
- PIN_SETUP
- PIN_CONFIRM
- PIN_LOGIN (authentication for returning users)
- MAIN_MENU
- DEAL_LIST
- DEAL_ACTIONS
- CONFIRM_ACTION
- ENTER_PIN
- DISPUTE_REASON
- ENTER_DISPUTE_PIN
- CREATE_DEAL_RECEIVER
- CREATE_DEAL_DRIVER
- CREATE_DEAL_AMOUNT
- CREATE_DEAL_CONFIRM
- VIEW_STATUS

#### 3. Backend Client
Thin wrapper for Phase 2 REST API:
- setPin()
- createDeal()
- lockFunds()
- markShipped()
- markDelivered()
- revokeDeal()
- cancelDeal()
- getActiveDeals()
- getDealDetails()
- getNotifications()

## API Endpoints

### POST /ussd
Main USSD endpoint (CON/END protocol)

**Request:**
```json
{
  "sessionId": "abc123",
  "phoneNumber": "0788123456",
  "text": "1*2*3"
}
```

**Response:**
```
CON Menu text here
```
or
```
END Final message
```

### GET /health
Health check

**Response:**
```json
{
  "status": "healthy",
  "sessions": 3,
  "timestamp": "2026-07-12T..."
}
```

### GET /sessions/:sessionId
Debug endpoint - get session info

### GET /notifications/:phone
Get SMS notifications for phone number

## Testing

### Manual Testing

Use the simulator UI - open 3 browser tabs or windows to simulate multiple phones.

### Automated Testing

```bash
# Test initial dial
curl -X POST http://localhost:4000/ussd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test1",
    "phoneNumber": "0788999999",
    "text": ""
  }'

# Test menu navigation
curl -X POST http://localhost:4000/ussd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test1",
    "phoneNumber": "0788999999",
    "text": "1"
  }'
```

### Test Scenarios

**Happy Path:**
1. Create deal
2. Lock funds
3. Mark shipped
4. Mark delivered
5. Auto-release (3 hour wait)

**Dispute Path:**
1. Create deal
2. Lock funds
3. Mark shipped
4. Mark delivered
5. Dispute within 3 hours
6. Admin resolution

**Error Cases:**
- Invalid phone number format
- Wrong PIN (5 attempts → lockout)
- Session timeout
- Invalid menu choices
- Deal not found
- Insufficient balance

## Configuration

### Environment Variables

```env
PORT=4000                              # USSD server port
BACKEND_API_URL=http://localhost:3000  # Phase 2 backend
SESSION_TIMEOUT_SECONDS=90             # Session timeout (90s allows phone number entry)
SESSION_CLEANUP_INTERVAL_MS=60000      # Cleanup frequency
USSD_SHORTCODE=*384*96#                # Display shortcode
```

### Session Timeout

Default 90 seconds allows time for users to type phone numbers on feature phone keypads. Adjust if needed:

```env
SESSION_TIMEOUT_SECONDS=120  # 2 minutes for very slow typers
```

## Troubleshooting

### "Session expired" immediately

Check `SESSION_TIMEOUT_SECONDS` is reasonable (≥60 recommended).

### Backend errors

Ensure Phase 2 backend is running:
```bash
curl http://localhost:3000/health
```

### SMS not showing

1. Check backend has notifications endpoint
2. Verify phone number format matches
3. Open browser console for errors

### Menu not advancing

1. Check session is active (green status)
2. Verify input is numeric
3. Check server logs for errors

## Performance

### Metrics
- **Session creation:** <10ms
- **Menu rendering:** <50ms
- **Backend API call:** 100-500ms
- **Session cleanup:** Every 60 seconds

### Scalability
- In-memory sessions support ~10K concurrent
- For production, use Redis for session store
- Current implementation is prototype-grade

## Security Notes

### Prototype Limitations
- ⚠️ PINs transmitted in plain text (use HTTPS in production)
- ⚠️ No rate limiting (add in production)
- ⚠️ In-memory sessions (lost on restart)
- ⚠️ No session encryption

### Production Checklist
- [ ] Enable HTTPS
- [ ] Implement rate limiting per phone number
- [ ] Use Redis for session store
- [ ] Add request signing/validation
- [ ] Implement phone number verification
- [ ] Add monitoring and alerting
- [ ] Use proper logging (Winston/Bunyan)

## Integration with Real Gateway

### Africa's Talking

1. Register shortcode
2. Configure callback URL: `https://your-domain.com/ussd`
3. No code changes needed - protocol matches exactly

### Request Mapping

If gateway uses different parameter names:

```javascript
// Adapter example
app.post('/ussd-gateway', (req, res) => {
  const standardRequest = {
    sessionId: req.body.SessionID,      // Map from gateway format
    phoneNumber: req.body.MSISDN,
    text: req.body.UserInput,
  };
  
  // Forward to standard handler
  handleUssd(standardRequest, res);
});
```

## Documentation

- `USSD_PROTOCOL.md` - Complete CON/END protocol specification
- `MENU_TREE.md` - Full navigation tree and node details
- `IMPLEMENTATION_STATUS.md` - Development progress tracker

## Support

### Logs

Server logs show each request:
```
📱 USSD Request: 0788123456 | Session: abc123 | Input: "1*2"
```

### Debug Session

```bash
curl http://localhost:4000/sessions/abc123
```

### Common Issues

**Q: Menu stuck on same screen**  
A: Check input is valid for current menu

**Q: PIN lockout not resetting**  
A: Backend enforces 15-minute lockout from Phase 2

**Q: Deals not showing**  
A: Verify backend is running and has data

## Development

### Project Structure

```
ussd-service/
├── src/
│   ├── server.js              # Main server + CON/END protocol
│   ├── session/
│   │   └── SessionStore.js    # Session management
│   ├── client/
│   │   └── BackendClient.js   # Phase 2 API wrapper
│   ├── menus/
│   │   ├── MenuNode.js        # Base node class
│   │   ├── MenuRegistry.js    # Node registration
│   │   ├── index.js           # Registry initialization
│   │   └── nodes/             # 14 menu node implementations
│   └── utils/
│       ├── validators.js      # Input validation
│       └── menuHelpers.js     # Display formatting
├── simulator-ui/
│   └── index.html             # Browser-based simulator
├── package.json
├── .env.example
└── README.md
```

### Adding a New Menu Node

1. Create node class extending `MenuNode`
2. Implement `render()` and `handleInput()`
3. Register in `src/menus/index.js`
4. Update `MENU_TREE.md`

Example:
```javascript
const MenuNode = require('../MenuNode');

class MyCustomNode extends MenuNode {
  constructor() {
    super('MY_CUSTOM_NODE');
  }

  async render(session, backendClient) {
    return this.con('My custom menu:\n1. Option A\n2. Option B');
  }

  async handleInput(input, session, sessionStore, backendClient) {
    // Handle input and return next node
    return {
      nextNode: 'NEXT_NODE_ID',
      message: this.con('Next screen text'),
    };
  }
}
```

## Phase Progress

✅ **Completed:**
- Session management with timeout
- 14 menu nodes (complete tree)
- CON/END protocol
- Backend API client
- Simulator UI
- Documentation

🎯 **Phase 3 demo scaffold**

Ready for local three-phone demos (PIN, deals, Processing + SMS inbox) when backend + contracts are configured. Not a production USSD gateway.

