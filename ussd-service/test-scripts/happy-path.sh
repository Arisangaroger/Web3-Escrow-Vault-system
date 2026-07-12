#!/bin/bash

# Happy Path Test Script for USSD Service
# Tests complete deal lifecycle via automated HTTP requests

USSD_URL="http://localhost:4000/ussd"
PHONE1="+250788111111"
PHONE2="+250788222222"
PHONE3="+250788333333"
SESSION1="test_$(date +%s)_1"
SESSION2="test_$(date +%s)_2"
SESSION3="test_$(date +%s)_3"

echo "🧪 USSD Happy Path Test"
echo "======================="
echo ""

# Helper function to send USSD request
send_ussd() {
    local session=$1
    local phone=$2
    local text=$3
    local desc=$4
    
    echo "📱 $desc"
    echo "   Session: $session"
    echo "   Phone: $phone"
    echo "   Input: $text"
    
    response=$(curl -s -X POST "$USSD_URL" \
        -H "Content-Type: application/json" \
        -d "{\"sessionId\":\"$session\",\"phoneNumber\":\"$phone\",\"text\":\"$text\"}")
    
    echo "   Response: $(echo $response | head -c 100)..."
    echo ""
    
    sleep 1
}

echo "Step 1: Phone 1 (Sender) - Initial Dial & PIN Setup"
send_ussd "$SESSION1" "$PHONE1" "" "Dial USSD"
send_ussd "$SESSION1" "$PHONE1" "1111" "Set PIN"
send_ussd "$SESSION1" "$PHONE1" "1111*1111" "Confirm PIN"

echo "Step 2: Phone 1 - Create Deal"
send_ussd "$SESSION1" "$PHONE1" "1111*1111*4" "Main Menu → Create Deal"
send_ussd "$SESSION1" "$PHONE1" "1111*1111*4*$PHONE3" "Enter Receiver"
send_ussd "$SESSION1" "$PHONE1" "1111*1111*4*$PHONE3*$PHONE2" "Enter Driver"
send_ussd "$SESSION1" "$PHONE1" "1111*1111*4*$PHONE3*$PHONE2*1000" "Enter Amount"
send_ussd "$SESSION1" "$PHONE1" "1111*1111*4*$PHONE3*$PHONE2*1000*1" "Confirm Deal"
send_ussd "$SESSION1" "$PHONE1" "1111*1111*4*$PHONE3*$PHONE2*1000*1*1111" "Enter PIN"

echo "Step 3: Phone 3 (Receiver) - Lock Funds"
send_ussd "$SESSION3" "$PHONE3" "" "Dial USSD"
send_ussd "$SESSION3" "$PHONE3" "3333" "Set PIN"
send_ussd "$SESSION3" "$PHONE3" "3333*3333" "Confirm PIN"
send_ussd "$SESSION3" "$PHONE3" "3333*3333*3" "Main Menu → Purchases"
send_ussd "$SESSION3" "$PHONE3" "3333*3333*3*1" "Select Deal"
send_ussd "$SESSION3" "$PHONE3" "3333*3333*3*1*1" "Lock Funds"
send_ussd "$SESSION3" "$PHONE3" "3333*3333*3*1*1*1" "Confirm"
send_ussd "$SESSION3" "$PHONE3" "3333*3333*3*1*1*1*3333" "Enter PIN"

echo "Step 4: Phone 1 (Sender) - Mark Shipped"
SESSION1_NEW="test_$(date +%s)_1_new"
send_ussd "$SESSION1_NEW" "$PHONE1" "" "Dial USSD"
send_ussd "$SESSION1_NEW" "$PHONE1" "1" "Main Menu → Shipments"
send_ussd "$SESSION1_NEW" "$PHONE1" "1*1" "Select Deal"
send_ussd "$SESSION1_NEW" "$PHONE1" "1*1*1" "Mark Shipped"
send_ussd "$SESSION1_NEW" "$PHONE1" "1*1*1*1" "Confirm"
send_ussd "$SESSION1_NEW" "$PHONE1" "1*1*1*1*1111" "Enter PIN"

echo "Step 5: Phone 2 (Driver) - Mark Delivered"
send_ussd "$SESSION2" "$PHONE2" "" "Dial USSD"
send_ussd "$SESSION2" "$PHONE2" "2222" "Set PIN"
send_ussd "$SESSION2" "$PHONE2" "2222*2222" "Confirm PIN"
send_ussd "$SESSION2" "$PHONE2" "2222*2222*2" "Main Menu → Deliveries"
send_ussd "$SESSION2" "$PHONE2" "2222*2222*2*1" "Select Deal"
send_ussd "$SESSION2" "$PHONE2" "2222*2222*2*1*1" "Mark Delivered"
send_ussd "$SESSION2" "$PHONE2" "2222*2222*2*1*1*1" "Confirm"
send_ussd "$SESSION2" "$PHONE2" "2222*2222*2*1*1*1*2222" "Enter PIN"

echo "✅ Happy Path Test Complete!"
echo ""
echo "📋 Summary:"
echo "   - Phone 1 created deal and marked shipped"
echo "   - Phone 3 locked funds"
echo "   - Phone 2 marked delivered"
echo "   - All parties should have received SMS notifications"
echo "   - Deal will auto-release after 3 hours"
echo ""
echo "🔍 Verify:"
echo "   1. Check USSD server logs for all transactions"
echo "   2. Check backend for deal status"
echo "   3. Open simulator UI to see SMS messages"
echo "   4. Query backend: curl http://localhost:3000/deals/0"
