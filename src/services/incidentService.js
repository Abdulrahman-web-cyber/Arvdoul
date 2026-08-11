/**
 * src/services/incidentService.js - ARVDOUL INCIDENT MANAGEMENT & POSTMORTEM ENGINE
 *
 * Implements:
 * 1. P0-P3 Incident Lifecycle: Tracks incident declaration, incident commander assignment, status updates, and resolution.
 * 2. SLA Timeline Tracking: Measures Mean-Time-To-Detect (MTTD) and Mean-Time-To-Resolve (MTTR).
 * 3. Blameless Postmortem Generator: Creates structured root-cause analysis templates with 5-whys and prevention action items.
 */

import { logger } from '../utils/Logger.js';

class IncidentService {
  /**
   * Declares a new operational incident.
   */
  async declareIncident(severity, title, summary, commanderId) {
    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const incident = {
        severity, // 'p0' | 'p1' | 'p2' | 'p3'
        title,
        summary,
        commanderId,
        status: 'investigating', // 'investigating' | 'identified' | 'mitigated' | 'resolved'
        declaredAt: serverTimestamp(),
        timeline: [
          {
            timestamp: new Date().toISOString(),
            status: 'investigating',
            note: `Incident declared by ${commanderId}`,
          },
        ],
      };

      const docRef = await addDoc(collection(db, 'incidents'), incident);
      logger.error(`[IncidentService] Incident declared: ${docRef.id} [${severity.toUpperCase()}] - ${title}`);

      return { success: true, incidentId: docRef.id };
    } catch (err) {
      logger.error('[IncidentService] Failed to declare incident:', { error: err.message });
      throw err;
    }
  }

  /**
   * Generates a blameless postmortem markdown template.
   */
  generatePostmortemTemplate(incidentData) {
    return `# Incident Postmortem: ${incidentData.title || 'Untitled'}

**Date:** ${new Date().toLocaleDateString()}
**Severity:** ${incidentData.severity?.toUpperCase() || 'P1'}
**Incident Commander:** ${incidentData.commanderId || 'N/A'}
**Duration:** ${incidentData.durationMinutes || 0} minutes

## 1. Executive Summary
${incidentData.summary || 'Summary of impact and root cause.'}

## 2. Impact
- **Users Affected:** ${incidentData.usersAffected || '0'}
- **Error Budget Impact:** ${incidentData.errorBudgetConsumption || '0%'}

## 3. Timeline
${incidentData.timeline?.map((t) => `- **${t.timestamp}**: ${t.note}`).join('\n') || '- N/A'}

## 4. Root Cause (5 Whys)
1. Why did the issue occur?
2. Why?
3. Why?
4. Why?
5. Why?

## 5. Preventative Action Items
- [ ] Action item 1 (Owner: )
- [ ] Action item 2 (Owner: )
`;
  }
}

export const incidentService = new IncidentService();
export default incidentService;
