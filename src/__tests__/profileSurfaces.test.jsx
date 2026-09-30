/**
 * src/__tests__/profileSurfaces.test.jsx
 *
 * Behavioural tests for the Profile institutional surfaces. These lock in the
 * two invariants the Profile blueprint depends on:
 *
 *   1. Fail-closed authorization: a surface renders nothing unless the
 *      capability engine authorized it AND a real projection exists.
 *   2. No fabrication: an absent value is shown as unknown, never as a
 *      plausible placeholder (no "$0" balance, no invented tier or band).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import ProfilePassportCard from '../components/profile/ProfilePassportCard';
import ProfileEconomyCard from '../components/profile/ProfileEconomyCard';
import ProfileAchievements from '../components/profile/ProfileAchievements';
import ProfileNationStanding from '../components/profile/ProfileNationStanding';

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
};

const renderWithRouter = (ui, initialEntries = ['/profile/u1']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <div data-testid="surface-under-test">{ui}</div>
      <LocationProbe />
    </MemoryRouter>
  );

// Latest render's surface wrapper (a test may render more than once).
const surfaceContainer = () => {
  const all = screen.getAllByTestId('surface-under-test');
  return all[all.length - 1];
};

const FULL_PASSPORT = {
  userId: 'u1',
  citizenId: 'ARV-U1',
  displayName: 'Aria Vance',
  username: 'ariavance',
  citizenTier: { tier: 'Statesperson', icon: '👑', description: 'Senior civic standing' },
  primaryTitle: 'Nation Builder',
  rankTitle: 'Luminary',
  reputation: { score: 92, band: 'Highly Trusted' },
  issueDate: 'Jan 2026',
  isVerified: true,
};

describe('ProfilePassportCard', () => {
  it('renders nothing when the viewer is not authorized', () => {
    renderWithRouter(
      <ProfilePassportCard passport={FULL_PASSPORT} canView={false} />
    );
    expect(surfaceContainer()).toBeEmptyDOMElement();
  });

  it('renders nothing when no authorized projection exists', () => {
    renderWithRouter(
      <ProfilePassportCard passport={null} canView />
    );
    expect(surfaceContainer()).toBeEmptyDOMElement();
  });

  it('presents the authorized projection verbatim', () => {
    renderWithRouter(<ProfilePassportCard passport={FULL_PASSPORT} canView isOwner />);
    expect(screen.getByText(/CITIZEN DOCUMENT · ARV-U1/)).toBeInTheDocument();
    expect(screen.getByText('Statesperson')).toBeInTheDocument();
    expect(screen.getByText('Nation Builder')).toBeInTheDocument();
    expect(screen.getByText('Highly Trusted · 92/100')).toBeInTheDocument();
  });

  it('shows an honest unestablished state instead of inventing a tier or trust', () => {
    renderWithRouter(
      <ProfilePassportCard
        passport={{
          userId: 'u2',
          citizenId: 'ARV-U2',
          displayName: 'New Citizen',
          citizenTier: null,
          primaryTitle: null,
          rankTitle: null,
          reputation: null,
          issueDate: null,
        }}
        canView
      />
    );
    expect(screen.getAllByText('Unestablished').length).toBeGreaterThan(0);
    expect(screen.getByText('Not yet established')).toBeInTheDocument();
    // The document number is authoritative and always present.
    expect(screen.getByText(/ARV-U2/)).toBeInTheDocument();
  });

  it('deep-links to the canonical Passport screen for the target', () => {
    renderWithRouter(<ProfilePassportCard passport={FULL_PASSPORT} canView />);
    fireEvent.click(screen.getByRole('button', { name: /open this citizen's digital passport/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/passport/u1');
  });
});

describe('ProfileEconomyCard', () => {
  it('renders nothing for a non-owner viewer', () => {
    renderWithRouter(
      <ProfileEconomyCard wallet={{ availableCoins: 100 }} balance={100} isOwner={false} canView />
    );
    expect(surfaceContainer()).toBeEmptyDOMElement();
  });

  it('renders nothing when the owner is not authorized for economy data', () => {
    renderWithRouter(
      <ProfileEconomyCard wallet={{ availableCoins: 100 }} balance={100} isOwner canView={false} />
    );
    expect(surfaceContainer()).toBeEmptyDOMElement();
  });

  it('presents ledger-backed figures for an authorized owner', () => {
    renderWithRouter(
      <ProfileEconomyCard
        wallet={{ availableCoins: 1500, totalEarned: 4000, totalSpent: 2500, pendingCoins: 25 }}
        balance={1500}
        position={{ title: 'Duke', emoji: '🎩' }}
        isOwner
        canView
      />
    );
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('4,000')).toBeInTheDocument();
    expect(screen.getByText('2,500')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Duke')).toBeInTheDocument();
  });

  it('never fabricates a zero balance when the wallet is unreadable', () => {
    renderWithRouter(
      <ProfileEconomyCard wallet={null} balance={null} isOwner canView />
    );
    expect(screen.getByText('Economy data unavailable')).toBeInTheDocument();
    // No fabricated figures anywhere in the surface.
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('ProfileAchievements', () => {
  it('renders nothing when there are no labelled achievements', () => {
    renderWithRouter(<ProfileAchievements achievements={[]} />);
    expect(surfaceContainer()).toBeEmptyDOMElement();

    renderWithRouter(
      <ProfileAchievements achievements={[{ id: 'x' }, { id: 'y', description: 'no label' }]} />
    );
    expect(surfaceContainer()).toBeEmptyDOMElement();
  });

  it('counts the authoritative array and caps the visible chips', () => {
    const achievements = Array.from({ length: 11 }, (_, i) => ({
      id: `a${i}`,
      title: `Milestone ${i}`,
    }));
    renderWithRouter(<ProfileAchievements achievements={achievements} />);
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('Milestone 0')).toBeInTheDocument();
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('hides the deep-link for visitor views', () => {
    renderWithRouter(
      <ProfileAchievements
        achievements={[{ id: 'a1', title: 'Pioneer' }]}
        showLink={false}
      />
    );
    expect(screen.queryByRole('button', { name: /open achievements/i })).not.toBeInTheDocument();
  });
});

describe('ProfileNationStanding', () => {
  it('renders nothing when no dimension is authoritative', () => {
    renderWithRouter(<ProfileNationStanding />);
    expect(surfaceContainer()).toBeEmptyDOMElement();
  });

  it('renders only the segments that have authoritative data', () => {
    renderWithRouter(
      <ProfileNationStanding
        reputation={{ reputation: { score: 88, band: 'Highly Trusted' } }}
        badges={{ first_post: { earned: true } }}
        rank={null}
        activeTitle={null}
      />
    );
    expect(screen.getByText('Reputation')).toBeInTheDocument();
    expect(screen.getByText('Highly Trusted')).toBeInTheDocument();
    expect(screen.getByText('Badges')).toBeInTheDocument();
    // No rank or title was supplied, so neither segment is invented.
    expect(screen.queryByText('Creator Rank')).not.toBeInTheDocument();
    expect(screen.queryByText('Title')).not.toBeInTheDocument();
  });
});
