// src/services/vendorManagementService.js

import { logger } from '../utils/Logger.js';

class VendorManagementService {
  constructor() {
    this.vendors = new Map([
      ['stripe', { name: 'Stripe Payments', status: 'healthy', p99LatencyMs: 240, uptimePercent: 99.99 }],
      ['firebase', { name: 'Google Cloud Firebase', status: 'healthy', p99LatencyMs: 45, uptimePercent: 99.99 }],
      ['cloudflare', { name: 'Cloudflare CDN / Stream', status: 'healthy', p99LatencyMs: 18, uptimePercent: 100.0 }],
      ['sendgrid', { name: 'SendGrid Email Gateway', status: 'healthy', p99LatencyMs: 310, uptimePercent: 99.95 }],
    ]);
  }

  getVendorsStatus() {
    return Array.from(this.vendors.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));
  }

  recordVendorError(vendorId) {
    const vendor = this.vendors.get(vendorId);
    if (vendor) {
      vendor.status = 'degraded';
      logger.warn(`[VendorManagement] Vendor ${vendor.name} marked as degraded.`);
    }
  }
}

export const vendorManagementService = new VendorManagementService();
export default vendorManagementService;
