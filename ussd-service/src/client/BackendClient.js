const axios = require('axios');

/**
 * Client for Phase 2 Backend API
 * All business logic lives in backend - this is just a thin HTTP wrapper
 */
class BackendClient {
  constructor(baseURL) {
    this.client = axios.create({
      baseURL,
      // Quick calls (pin-status, verify-pin, notifications). Chain actions use fire-and-forget from menus.
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  encodePhone(phoneNumber) {
    return encodeURIComponent(phoneNumber);
  }

  /**
   * Whether user has completed PIN setup (new vs returning routing)
   */
  async getPinStatus(phoneNumber) {
    const response = await this.client.get(
      `/users/${this.encodePhone(phoneNumber)}/pin-status`,
    );
    return response.data;
  }

  async setPin(phoneNumber, pin) {
    const response = await this.client.post(
      `/users/${this.encodePhone(phoneNumber)}/pin`,
      { pin },
    );
    return response.data;
  }

  async verifyPin(phoneNumber, pin) {
    const response = await this.client.post(
      `/users/${this.encodePhone(phoneNumber)}/verify-pin`,
      { pin },
    );
    return response.data;
  }

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

  async lockFunds(phoneNumber, dealId, pin) {
    const response = await this.client.post(`/deals/${dealId}/lock`, {
      phone: phoneNumber,
      pin,
    });
    return response.data;
  }

  async markShipped(phoneNumber, dealId, pin) {
    const response = await this.client.post(`/deals/${dealId}/ship`, {
      phone: phoneNumber,
      pin,
    });
    return response.data;
  }

  async markDelivered(phoneNumber, dealId, pin) {
    const response = await this.client.post(`/deals/${dealId}/deliver`, {
      phone: phoneNumber,
      pin,
    });
    return response.data;
  }

  async revokeDeal(phoneNumber, dealId, reasonCode, pin) {
    const response = await this.client.post(`/deals/${dealId}/revoke`, {
      phone: phoneNumber,
      reasonCode,
      pin,
    });
    return response.data;
  }

  async cancelDeal(phoneNumber, dealId, pin) {
    const response = await this.client.post(`/deals/${dealId}/cancel`, {
      phone: phoneNumber,
      pin,
    });
    return response.data;
  }

  async getActiveDeals(phoneNumber) {
    const response = await this.client.get(
      `/users/${this.encodePhone(phoneNumber)}/deals`,
    );
    return response.data;
  }

  async getDealDetails(dealId) {
    const response = await this.client.get(`/deals/${dealId}`);
    return response.data;
  }

  async getNotifications(phoneNumber) {
    const response = await this.client.get(
      `/users/${this.encodePhone(phoneNumber)}/notifications`,
    );
    return response.data;
  }

  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

module.exports = BackendClient;
