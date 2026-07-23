# KNOWN LIMITATIONS

**Generated**: 2026-07-23
**Last Updated**: Phase 0 Audit

---

## PRODUCT LIMITATIONS

### Authentication
| Issue | Severity | Status |
|-------|----------|--------|
| MFA (TOTP) not implemented | Medium | Not started |
| Backup codes not implemented | Medium | Not started |
| Session revocation UI not complete | Low | Partial |

### Social Features
| Issue | Severity | Status |
|-------|----------|--------|
| Reposts not implemented | Medium | Not started |
| Close friends list not implemented | Low | Not started |
| Restrict accounts not implemented | Low | Not started |
| Trust relationships not implemented | Low | Not started |
| Community membership not implemented | High | Not started |
| Creator subscriptions not implemented | High | Not started |

### Content Features
| Issue | Severity | Status |
|-------|----------|--------|
| Articles/rich text not implemented | Medium | Not started |
| Story highlights manual curation | Low | Partial |
| Video thumbnail designer not implemented | Low | Not started |
| Video editing in-browser not complete | Medium | Partial |

### Monetization
| Issue | Severity | Status |
|-------|----------|--------|
| Subscriptions not implemented | High | Not started |
| Paid content access control not complete | High | Partial |
| Tax calculation not implemented | Medium | Not started |
| Refund policy enforcement not complete | Medium | Partial |

### Communities & Events
| Issue | Severity | Status |
|-------|----------|--------|
| Full community system not implemented | High | Not started |
| Community spaces not implemented | High | Not started |
| Event RSVP/ticketing not implemented | Medium | Not started |
| Event check-in not implemented | Medium | Not started |

### Live Streaming
| Issue | Severity | Status |
|-------|----------|--------|
| RTMP ingest not implemented | High | Not started |
| Live viewer count not real-time | Medium | Partial |
| Live moderation not complete | Medium | Not started |
| Live recording/replay not complete | Medium | Not started |

### Admin & Moderation
| Issue | Severity | Status |
|-------|----------|--------|
| Admin console not implemented | High | Not started |
| Moderation queue not implemented | High | Not started |
| Audit logs UI not implemented | Medium | Not started |
| Appeal system not implemented | Medium | Not started |
| Content flagging not complete | Medium | Partial |

### Settings & Privacy
| Issue | Severity | Status |
|-------|----------|--------|
| Accessibility settings not implemented | Medium | Not started |
| Data export not implemented | Medium | Not started |
| Two-factor authentication UI not complete | Medium | Not started |
| Login sessions management UI incomplete | Low | Partial |
| Activity history not complete | Low | Partial |

---

## TECHNICAL LIMITATIONS

### Performance
| Issue | Impact | Workaround |
|-------|--------|------------|
| Large feed loads slow | User experience | Pagination/caching |
| No virtual scrolling in some lists | Performance | Add react-virtual |
| Images not lazy loaded everywhere | Performance | Add lazy loading |
| No service worker for offline | Offline mode | Implement SW |

### Scalability
| Issue | Impact | Workaround |
|-------|--------|------------|
| Fanout on write for large followings | Write limits | Fanout on read pattern |
| No sharded counters for views | Write limits | Implement sharding |
| No CDN for media delivery | Load times | Add Firebase CDN |
| No image optimization service | Bandwidth | Add Cloudinary/Imgix |

### Security
| Issue | Impact | Workaround |
|-------|--------|------------|
| No CAPTCHA on signup | Spam | Add reCAPTCHA |
| Rate limiting basic | DoS | Enhanced rate limiting |
| No request signing | API security | Add HMAC |
| No IP-based blocking | Abuse | Add firewall rules |

### Reliability
| Issue | Impact | Workaround |
|-------|--------|------------|
| No dead letter queue UI | Debugging | Manual Firestore |
| No circuit breakers | Cascading failures | Add retry logic |
| No health checks | Monitoring | Add status endpoint |
| No backup/restore UI | Data safety | Manual Firebase |

---

## TESTING GAPS

| Gap | Impact |
|-----|--------|
| No unit tests | Regression risk |
| No integration tests | Integration bugs |
| No security rules tests | Rule vulnerabilities |
| No E2E tests | User flow bugs |
| No load tests | Performance issues |
| No accessibility tests | WCAG violations |
| No security scanning | Vulnerabilities |

---

## DOCUMENTATION GAPS

| Gap | Impact |
|-----|--------|
| No API documentation | Developer onboarding |
| No deployment guide | Release process |
| No runbook for incidents | MTTR |
| No architecture diagrams | Understanding |
| No data dictionary | Data clarity |

---

## EXTERNAL DEPENDENCIES

| Dependency | Limitation |
|------------|------------|
| Firebase | Vendor lock-in |
| Google Cloud | Cost predictability |
| Twilio (if used) | SMS costs |
| SendGrid (if used) | Email costs |

---

## MOBILE GAPS

| Gap | Impact |
|-----|--------|
| No PWA manifest complete | Installability |
| No native app | Platform features |
| No push on iOS | Engagement |
| No offline posts | Connectivity |

---

## ACCESSIBILITY GAPS

| Gap | WCAG Level |
|-----|------------|
| Keyboard navigation not complete | AA |
| Screen reader support not tested | AA |
| Color contrast not audited | AA |
| Focus indicators incomplete | AA |
| Alt text not enforced | A |
| prefers-reduced-motion partial | AA |

---

## FINANCIAL COMPLIANCE

| Gap | Risk |
|-----|------|
| No formal refund policy | Legal |
| No tax calculation | Compliance |
| No audit logging UI | Financial |
| No reconciliation automation | Errors |

---

## REGIONAL/LOCALIZATION

| Gap | Impact |
|-----|--------|
| English only | Global reach |
| No RTL support | MENA market |
| No timezone handling | Events |
| No currency conversion | International |

---

## BACKLOG PRIORITY ORDER

### Critical (Block Launch)
1. Add test suite
2. Admin console basics
3. Content moderation queue
4. Security scanning

### High (Post-Launch)
5. Communities system
6. Creator subscriptions
7. Live streaming
8. Accessibility audit

### Medium (Phase 2)
9. MFA completion
10. Data export
11. Events RSVP
12. Accessibility settings

### Low (Future)
13. Articles system
14. Video editor
15. Multiple languages
