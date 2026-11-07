// src/components/Shared/FeatureGate.jsx
//
// Renders `children` only when a registered feature flag is enabled. The gate is
// reactive (see useFeatureFlag), so flipping a kill switch hides the surface
// without a reload.

import { useFeatureFlag } from '../../hooks/useFeatureFlag.js';

/**
 * @param {Object} props
 * @param {string} props.flag - registered flag name
 * @param {React.ReactNode} [props.fallback] - rendered when the flag is off
 * @param {React.ReactNode} props.children
 */
export default function FeatureGate({ flag, fallback = null, children }) {
  const enabled = useFeatureFlag(flag);
  return enabled ? children : fallback;
}
