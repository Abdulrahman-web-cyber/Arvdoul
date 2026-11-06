/**
 * VideoEditorScreen mount guard.
 *
 * The screen used to throw on first render (`totalDuration` called `.map` on
 * the undefined `clips` of each initial track), so the /video-editor route only
 * ever showed its error boundary. This renders the real screen and asserts the
 * timeline chrome is present — no browser required.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true, toggleTheme: jest.fn() }),
  ThemeProvider: ({ children }) => children,
}));

import VideoEditorScreen from '../screens/VideoEditor/VideoEditorScreen.jsx';

test('VideoEditorScreen mounts and renders the timeline chrome', () => {
  render(
    <MemoryRouter>
      <VideoEditorScreen />
    </MemoryRouter>
  );
  // Layer panel toggle + track "Add Track" affordance only exist when the
  // timeline data model is intact.
  expect(screen.getByText('Layers')).toBeTruthy();
  expect(screen.getAllByText(/Add Track/).length).toBeGreaterThan(0);
});
