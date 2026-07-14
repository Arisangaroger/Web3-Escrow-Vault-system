# USSD Protocol Specification

## Overview

This document specifies the CON/END protocol used for USSD communication, matching the Africa's Talking gateway standard. This ensures future integration with real telecom gateways requires minimal changes.

## Request Format

Every USSD request contains the following parameters:

```json
{
  "sessionId": "string",    // Unique session identifier
  "phoneNumber": "string",  // User's phone number (local 07XXXXXXXX preferred)
  "text": "string"          // Accumulated user input, separated by *
}
```

### Examples

**Initial dial (empty text):**
```json
{
  "sessionId": "ATUid_abc123",
  "phoneNumber": "0788123456",
  "text": ""
}
```

**User selects option 1:**
```json
{
  "sessionId": "ATUid_abc123",
  "phoneNumber": "0788123456",
  "text": "1"
}
```

**User navigates through menu (1 → 2 → 3):**
```json
{
  "sessionId": "ATUid_abc123",
  "phoneNumber": "0788123456",
  "text": "1*2*3"
}
```

## Response Format

Responses are plain text with a prefix indicating session continuation:

### CON (Continue Session)

Prefix: `CON `

Indicates the session should continue. The message is displayed to the user, who can then enter more input.

```
CON Welcome to Escrow Platform
1. My Shipments
2. My Deliveries
3. My Purchases
4. Create New Deal
```

### END (End Session)

Prefix: `END `

Indicates the session has ended. The message is displayed as a final screen, and no further input is accepted.

```
END Deal created successfully!
Deal ID: 42
All parties have been notified.
```

## Protocol Rules

### 1. Stateless Requests

Each request is independent. The server must use `sessionId` to maintain state across requests.

### 2. Text Accumulation

The `text` parameter accumulates all user input in a single session, separated by `*`:
- First input: `"1"`
- Second input: `"1*2"`
- Third input: `"1*2*3"`

The last segment (after the final `*`) is the most recent user input.

### 3. Session Timeout

Sessions expire after inactivity (default: 90 seconds). If a user sends input after expiration:

```
END Session expired. Please dial again.
```

### 4. Character Limits

USSD screens typically support ~160-182 characters total. Messages should be concise.

### 5. Numeric Input Convention

Menus use numeric choices:
```
CON Main Menu:
1. Option A
2. Option B
3. Option C
0. Back
```

`0` conventionally means "Back" or "Cancel"

## Session Lifecycle

### New Session

1. User dials shortcode (e.g., `*384*96#`)
2. Gateway sends request with empty `text`
3. Server creates session and returns CON menu
4. User enters digit
5. Gateway sends request with `text="1"`
6. Cycle continues until END message

### Session Flow Example

```
Request:  { sessionId: "abc", phoneNumber: "0788123456", text: "" }
Response: CON Main Menu:\n1. My Shipments\n2. My Deliveries

Request:  { sessionId: "abc", phoneNumber: "0788123456", text: "1" }
Response: CON My Shipments:\n1. Deal #42 (1000 RWF)\n0. Back

Request:  { sessionId: "abc", phoneNumber: "0788123456", text: "1*1" }
Response: CON Deal #42:\n1. Mark Shipped\n0. Back

Request:  { sessionId: "abc", phoneNumber: "0788123456", text: "1*1*1" }
Response: CON Enter your 4-digit PIN:

Request:  { sessionId: "abc", phoneNumber: "0788123456", text: "1*1*1*1234" }
Response: END Marked as shipped!\nAll parties notified via SMS.
```

Session ends after END message.

## Error Handling

### Invalid Input

Don't end session - re-display menu with error:

```
CON Invalid choice. Please select 1-4.

1. My Shipments
2. My Deliveries
3. My Purchases
4. Create New Deal
```

### System Error

End session with error message:

```
END System error. Please try again later.
```

### Backend API Error

Translate error to user-friendly message:

```
END This deal is no longer available.
```

## Integration with Real Gateway

### Africa's Talking

The protocol matches Africa's Talking's USSD API exactly. Integration requires:

1. Register shortcode with Africa's Talking
2. Configure callback URL pointing to `/ussd` endpoint
3. No code changes needed - protocol is identical

### Other Gateways

Most African telecom USSD gateways follow similar patterns:
- Request: sessionId, phoneNumber, text (sometimes called `serviceCode`, `msisdn`, `userInput`)
- Response: CON/END prefix with message

Minor adapter changes may be needed for parameter name mapping.

## Security Considerations

### 1. Session Validation

Always validate `sessionId` exists and hasn't expired before processing.

### 2. Phone Number Validation

Validate and normalize phone numbers: accept `07XXXXXXXX` from the handset, store/lookup as `+2507XXXXXXXX`.

### 3. PIN Masking

PINs are transmitted in plain text in the `text` parameter. Use HTTPS in production.

### 4. Replay Protection

Session IDs should be unique per session to prevent replay attacks.

### 5. Rate Limiting

Implement rate limiting per phone number to prevent abuse.

## Testing

### Manual Testing

Use the provided simulator UI (`simulator-ui/index.html`) to test the full menu tree.

### Automated Testing

Send POST requests to `/ussd` endpoint:

```bash
curl -X POST http://localhost:4000/ussd \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test123",
    "phoneNumber": "0788123456",
    "text": ""
  }'
```

### Load Testing

Simulate multiple concurrent sessions with different `sessionId` values.

## Appendix: Menu Tree Reference

See `MENU_TREE.md` for complete navigation flow.

## Appendix: Common Issues

### "Session expired" on first request

Check that `text` is empty string (`""`) not `null` for initial dial.

### Menu doesn't advance

Ensure `text` accumulation is correct (each input appended with `*` separator).

### Timeout too short

Increase `SESSION_TIMEOUT_SECONDS` in `.env` if users need more time (blockchain calls can take 2-5 seconds).

