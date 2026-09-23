import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileMyScreen from '../screens/Profile/ProfileMyScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import ProfilePublicScreen from '../screens/Profile/ProfilePublicScreen';

describe('Profile Screens Render Test', () => {
  it('renders ProfileMyScreen without throwing', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/profile']}>
          <ProfileMyScreen />
        </MemoryRouter>
      );
    }).not.toThrow();
  });

  it('renders ProfileScreen without throwing', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/profile/testuser']}>
          <ProfileScreen />
        </MemoryRouter>
      );
    }).not.toThrow();
  });

  it('renders ProfilePublicScreen without throwing', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/profile/public/testuser']}>
          <ProfilePublicScreen />
        </MemoryRouter>
      );
    }).not.toThrow();
  });
});
