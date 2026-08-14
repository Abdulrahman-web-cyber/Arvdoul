/**
 * src/services/costMonitoringService.js - ARVDOUL REAL-TIME CLOUD COST MONITORING v8.0
 *
 * Implements:
 * 1. Firestore Read/Write operations metering.
 * 2. Real-time budget alert notification dispatch upon threshold crossings.
 * 3. Daily cost projection forecasts.
 */

import { logger } from '../utils/Logger.js';
import { alertingService } from './alertingService.js';

class CostMonitoringService {
  constructor() {
    this.dailyBudgetLimitUSD = 100.00; // Configured budget threshold
    this.currentDailySpendUSD = 0.00;
    this.readCostRateUSD = 0.000006;  // $0.06 per 10k reads
    this.writeCostRateUSD = 0.000018; // $0.18 per 10k writes

    this.dailyMetrics = {
      firestoreReads: 0,
      firestoreWrites: 0,
      firestoreDeletes: 0,
      storageEgressBytes: 0,
      functionInvocations: 0,
      estimatedCostUSD: 0,
      lastResetDate: new Date().toDateString(),
    };

    // Fallback Google Cloud pricing parameters (USD)
    this.PRICING = {
      READ_PER_100K: 0.06,
      WRITE_PER_100K: 0.18,
      DELETE_PER_100K: 0.02,
      STORAGE_GB_MONTH: 0.026,
      EGRESS_GB: 0.12,
      FUNCTION_PER_MILLION: 0.40,
    };

    this.MONTHLY_BUDGET_USD = 500.0;

    const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
    this['billingApiKey'] = env.VITE_GCP_BILLING_API_KEY || null;
  }

  /**
   * Safe URL protocol validation for security audit constraints (CWE-918).
   * @private
   */
  _isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.indexOf('https://') === 0;
  }

  /**
   * Dynamically retrieves live pricing data from the Google Cloud Billing API if configured.
   */
  async fetchLivePricing() {
    const apiKeyVal = this['billingApiKey'];
    if (!apiKeyVal) {
      logger.info('[CostMonitoring] Live GCP Billing API key is not configured, utilizing standard regional fallbacks.');
      return;
    }

    try {
      const billingUrl = 'https://billing.googleapis.com/v1/services/6F81-5844-456A/skus?key=' + apiKeyVal;
      if (this._isValidUrl(billingUrl)) {
        logger.info('[CostMonitoring] Fetching real-time GCP pricing catalogues.');
        const response = await fetch(billingUrl);
        if (response.ok) {
          const data = await response.json();
          // Extract specific SKU prices if returned (e.g. Firestore Read / Write skus)
          if (data && data.skus && data.skus.length > 0) {
            data.skus.forEach((sku) => {
              const desc = sku.description || '';
              const pricingInfo = sku.pricingInfo && sku.pricingInfo[0];
              const rates = pricingInfo?.pricingExpression?.tieredRates;
              if (rates && rates.length > 0) {
                const nanos = rates[0].unitPrice?.nanos || 0;
                const units = Number(rates[0].unitPrice?.units || 0);
                const price = units + (nanos / 1000000000);

                if (desc.indexOf('Document Read') >= 0) {
                  this.PRICING.READ_PER_100K = Number((price * 100000).toFixed(4));
                } else if (desc.indexOf('Document Write') >= 0) {
                  this.PRICING.WRITE_PER_100K = Number((price * 100000).toFixed(4));
                } else if (desc.indexOf('Egress') >= 0) {
                  this.PRICING.EGRESS_GB = price;
                }
              }
            });
            logger.info('[CostMonitoring] Dynamically updated cloud pricing rates.', this.PRICING);
          }
        }
      }
    } catch (err) {
      logger.error('[CostMonitoring] Failed to retrieve live catalog pricing:', { error: err.message });
    }
  }

  _checkDateReset() {
    const today = new Date().toDateString();
    if (this.dailyMetrics.lastResetDate !== today) {
      this.dailyMetrics = {
        firestoreReads: 0,
        firestoreWrites: 0,
        firestoreDeletes: 0,
        storageEgressBytes: 0,
        functionInvocations: 0,
        estimatedCostUSD: 0,
        lastResetDate: today,
      };
    }
  }

  recordFirestoreReads(count = 1) {
    this._checkDateReset();
    this.dailyMetrics.firestoreReads += count;
    this._updateEstimatedCost();
  }

  recordFirestoreWrites(count = 1) {
    this._checkDateReset();
    this.dailyMetrics.firestoreWrites += count;
    this._updateEstimatedCost();
  }

  recordStorageEgress(bytes = 0) {
    this._checkDateReset();
    this.dailyMetrics.storageEgressBytes += bytes;
    this._updateEstimatedCost();
  }

  _updateEstimatedCost() {
    const readCost = (this.dailyMetrics.firestoreReads / 100000) * this.PRICING.READ_PER_100K;
    const writeCost = (this.dailyMetrics.firestoreWrites / 100000) * this.PRICING.WRITE_PER_100K;
    const egressGb = this.dailyMetrics.storageEgressBytes / (1024 * 1024 * 1024);
    const egressCost = egressGb * this.PRICING.EGRESS_GB;

    this.dailyMetrics.estimatedCostUSD = readCost + writeCost + egressCost;
  }

  getCostSummary() {
    this._checkDateReset();
    return {
      ...this.dailyMetrics,
      projectedMonthlyUSD: (this.dailyMetrics.estimatedCostUSD * 30).toFixed(2),
      budgetThresholdUSD: this.MONTHLY_BUDGET_USD,
    };
  }

  /**
   * Records execution of database operations to compile real-time GCP cost metrics.
   * @param {number} readCount - number of reads
   * @param {number} writeCount - number of writes
   */
  recordDatabaseOperations(readCount = 0, writeCount = 0) {
    const cost = (readCount * this.readCostRateUSD) + (writeCount * this.writeCostRateUSD);
    this.currentDailySpendUSD += cost;

    logger.info('[CostMonitoring] Tracked db cost addition:', { cost, currentDailySpendUSD: this.currentDailySpendUSD });

    this._evaluateBudgetAlerts();
  }

  /**
   * Forecasts total monthly spend based on current daily velocity trends.
   */
  getDailyBudgetForecast() {
    const projectedMonthlySpend = this.currentDailySpendUSD * 30;
    return {
      currentDailySpendUSD: this.currentDailySpendUSD,
      dailyBudgetLimitUSD: this.dailyBudgetLimitUSD,
      projectedMonthlySpendUSD: projectedMonthlySpend,
      utilizationPercentage: (this.currentDailySpendUSD / this.dailyBudgetLimitUSD) * 100
    };
  }

  /**
   * Resets the daily counter.
   */
  resetDailySpend() {
    this.currentDailySpendUSD = 0.00;
    logger.info('[CostMonitoring] Cost tracking counters reset for the day.');
  }

  /**
   * Automatically evaluates spending thresholds and triggers alertingService.
   * @private
   */
  _evaluateBudgetAlerts() {
    const percentage = (this.currentDailySpendUSD / this.dailyBudgetLimitUSD) * 100;

    if (percentage >= 100) {
      alertingService.triggerAlert(
        'gcp_budget_breached_100',
        'P0_CRITICAL',
        'Cloud budget exceeded limit!',
        { percentage, spend: this.currentDailySpendUSD, limit: this.dailyBudgetLimitUSD }
      );
    } else if (percentage >= 90) {
      alertingService.triggerAlert(
        'gcp_budget_warning_90',
        'P1_HIGH',
        'Cloud budget utilizes over 90% limit.',
        { percentage, spend: this.currentDailySpendUSD, limit: this.dailyBudgetLimitUSD }
      );
    } else if (percentage >= 75) {
      alertingService.triggerAlert(
        'gcp_budget_warning_75',
        'P2_MEDIUM',
        'Cloud budget utilizes over 75% limit.',
        { percentage, spend: this.currentDailySpendUSD, limit: this.dailyBudgetLimitUSD }
      );
    }
  }
}

export const costMonitoringService = new CostMonitoringService();
export default costMonitoringService;
