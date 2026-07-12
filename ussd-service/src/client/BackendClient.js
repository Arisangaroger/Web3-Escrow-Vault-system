const axios = require('axios');

/**
 * Client for Phase 2 Backend API
 * All business logic lives in backend - this is just a thin HTTP wrapper
 */
class BackendClient {
  constructor(baseURL) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Set PIN for first-time user
   */
  async setPin(phoneNumber, pin) {
    const response = await this.client.post(`/users/${phoneNumber}/pin`, { pin });
    return response.data;
  }

  /**
   * Create a new deal
   */
  async createDeal(senderPhone, driverPhone, receiverPhone, amount, pin) {
    const response = await this.client.post('/deals', {
      senderPhone,
      driverPhone,
      receiverPhone,
      amount,
      pin,
    });
    return response.data;
  }

  /**
   * Lock funds into escrow
   */
  async lockFunds(phoneNumber, dealId, pin) {
    const response = await this.client.post(`/deals/${dealId}/lock`, {
      phone: phoneNumber,
      pin,
    });
    return response.data;
  }

  /**
   * Mark goods as shipped
   */
  async markShipped(phoneNumber, dealId, pin) {
    const response = await this.client.post(`/deals/${dealId}/ship`, {
      phone: phoneNumber,
      pin,
    });
    return response.data;
  }

  /**
   * Mark goods as delivered
   */
  async markDelivered(phoneNumber, dealId, pin) {
    const response = await this.client.post(`/deals/${dealId}/deliver`, {
      phone: phoneNumber,
      pin,
    });
    return response.data;
  }

  /**
   * Revoke/dispute a deal
   */
  async revokeDeal(phoneNumber, dealId, reasonCode, pin) {
    const response = await this.client.post(`/deals/${dealId}/revoke`, {
      phone: phoneNumber,
      reasonCode,
      pin,
    });
    return response.data;
  }

  /**
   * Cancel deal before funds locked
   */
  async cancelDeal(phoneNumber, dealId, pin) {
    const response = await this.client.post(`/deals/${dealId}/cancel`, {
      phone: phoneNumber,
      pin,
    });
    return response.data;
  }

  /**
   * Get active deals for a phone number (role-segmented)
   */
  async getActiveDeals(phoneNumber) {
    const response = await this.client.get(`/users/${phoneNumber}/deals`);
    return response.data;
  }

  /**
   * Get specific deal details
   */
  async getDealDetails(dealId) {
    const response = await this.client.get(`/deals/${dealId}`);
    return response.data;
  }

  /**
   * Get notifications for a phone number
   */
  async getNotifications(phoneNumber) {
    const response = await this.client.get(`/users/${phoneNumber}/notifications`);
    return response.data;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

module.exports = BackendClient;
