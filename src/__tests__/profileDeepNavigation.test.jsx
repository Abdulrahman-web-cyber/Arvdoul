import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import ProfileDeepNavigation from '../components/profile/ProfileDeepNavigation';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderNav = (props) =>
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <ProfileDeepNavigation {...props} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('ProfileDeepNavigation — capability-gated deep links', () => {
  it('renders the full identity system set for an owner with economic capability', () => {
    renderNav({
      profile: { uid: 'u1', isCreator: true },
      isOwner: true,
      capabilities: { canViewProgression: true, canViewAchievements: true, canViewTitles: true, canViewIdentity: true, canViewEconomicStatus: true },
      theme: 'dark',
    });

    ['Progress', 'Achievements', 'Titles', 'Reputation', 'Rankings', 'Passport', 'Creator', 'Wallet'].forEach((label) => {
      expect(screen.getByLabelText(`Open ${label}`)).toBeInTheDocument();
    });
  });

  it('exposes only public systems to a visitor without capabilities', () => {
    renderNav({
      profile: { uid: 'u2' },
      isOwner: false,
      capabilities: { canViewProgression: false, canViewAchievements: false, canViewTitles: false, canViewIdentity: false, canViewEconomicStatus: false },
      theme: 'light',
    });

    expect(screen.getByLabelText('Open Reputation')).toBeInTheDocument();
    expect(screen.getByLabelText('Open Rankings')).toBeInTheDocument();
    ['Progress', 'Achievements', 'Titles', 'Passport', 'Wallet', 'Creator'].forEach((label) => {
      expect(screen.queryByLabelText(`Open ${label}`)).not.toBeInTheDocument();
    });
  });

  it('navigates to the canonical reputation route for the target account', () => {
    renderNav({ profile: { uid: 'u2' }, isOwner: false, capabilities: {}, theme: 'light' });

    fireEvent.click(screen.getByLabelText('Open Reputation'));
    expect(screen.getByTestId('location').textContent).toBe('/reputation/u2');
  });

  it('disables reputation when no target id is available but still allows rankings', () => {
    const { container } = renderNav({ profile: {}, isOwner: false, capabilities: {}, theme: 'light' });
    expect(screen.getByLabelText('Open Reputation')).toBeDisabled();
    expect(screen.getByLabelText('Open Rankings')).toBeEnabled();
    expect(container).not.toBeEmptyDOMElement();
  });
});
