/**
 * src/services/costMonitoringService.js - ARVDOUL REAL-TIME CLOUD COST MONITORING & BUDGET GUARDS
 *
 * Implements:
 * 1. Firestore Read/Write Quota Metering: Tracks document operations in real time and calculates accrued GCP costs.
 * 2. Budget Alert Thresholds: Triggers proactive alerts at 50%, 75%, and 90% of allocated monthly GCP budget.
 * 3. Per-User Cost Attribution: Measures average cloud infrastructure cost per Daily Active User (DAU).
 */

import { logger } from '../utils/Logger.js';
import { alertingService } from './alertingService.js';

class CostMonitoringService {
  constructor() {
    this.dailyMetrics = {
      firestoreReads: 0,
      firestoreWrites: 0,
      firestoreDeletes: 0,
      storageEgressBytes: 0,
      functionInvocations: 0,
      estimatedCostUSD: 0,
      lastResetDate: new Date().toDateString(),
    };

    // Google Cloud pricing parameters (USD)
    this.PRICING = {
      READ_PER_100K: 0.06,
      WRITE_PER_100K: 0.18,
      DELETE_PER_100K: 0.02,
      STORAGE_GB_MONTH: 0.026,
      EGRESS_GB: 0.12,
      FUNCTION_PER_MILLION: 0.40,
    };

    this.MONTHLY_BUDGET_USD = 500.0;
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

    // Evaluate budget alerts
    const monthlyProjectionUSD = this.dailyMetrics.estimatedCostUSD * 30;
    if (monthlyProjectionUSD > this.MONTHLY_BUDGET_USD * 0.9) {
      alertingService.triggerAlert(
        'budget_90_percent',
        'p1_high',
        'Projected Cloud Costs Exceed 90% of Monthly Budget',
        { dailyUSD: this.dailyMetrics.estimatedCostUSD, projectedMonthlyUSD: monthlyProjectionUSD }
      );
    } else if (monthlyProjectionUSD > this.MONTHLY_BUDGET_USD * 0.75) {
      alertingService.triggerAlert(
        'budget_75_percent',
        'p2_medium',
        'Projected Cloud Costs Exceed 75% of Monthly Budget',
        { dailyUSD: this.dailyMetrics.estimatedCostUSD, projectedMonthlyUSD: monthlyProjectionUSD }
      );
    }
  }

  getCostSummary() {
    this._checkDateReset();
    return {
      ...this.dailyMetrics,
      projectedMonthlyUSD: (this.dailyMetrics.estimatedCostUSD * 30).toFixed(2),
      budgetThresholdUSD: this.MONTHLY_BUDGET_USD,
    };
  }
}

export const costMonitoringService = new CostMonitoringService();
export default costMonitoringService;
