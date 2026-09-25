/**
 * src/screens/Profile/ProfileSettingsScreen.jsx - Canonical Settings Gateway
 * 
 * According to AGENTS.md single sources of truth:
 * /settings (src/screens/SettingsScreen.jsx) is the canonical settings screen.
 * /profile/settings redirects there. This component exports SettingsScreen
 * directly so any internal import resolves to the canonical implementation.
 */

import React from 'react';
import SettingsScreen from '../SettingsScreen';

export default function ProfileSettingsScreen(props) {
  return <SettingsScreen {...props} />;
}
