/**
 * Withdrawal level gate parity.
 *
 * The server (`functions/monetization.js` requestWithdrawal) and the wallet
 * screen must enforce the SAME gate: the canonical `getCreatorCapabilities`
 * from the shared levelConfig, never a bare `level >= N`. Before this test the
 * screen checked only the coin minimum, so a Level-1 user could submit a payout
 * the server then rejected.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LEVEL_GATES, getCreatorCapabilities } from '../shared/levelConfig.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('withdrawal level gate', () => {
  const gate = LEVEL_GATES.withdrawals;

  test('the gate is a real positive level and drives the capability helper', () => {
    expect(typeof gate).toBe('number');
    expect(gate).toBeGreaterThan(0);

    expect(getCreatorCapabilities({ level: gate - 1, isVerified: false }).canWithdraw).toBe(false);
    expect(getCreatorCapabilities({ level: gate, isVerified: false }).canWithdraw).toBe(true);
  });

  test('the server gate uses getCreatorCapabilities, not a bare level compare', () => {
    const src = read('functions/monetization.js');
    expect(src).toContain('getCreatorCapabilities');
    // No literal `level < 10`-style comparison against the gate constant.
    expect(src).not.toMatch(/level\s*<\s*LEVEL_GATES\.withdrawals/);
  });

  test('the wallet screen enforces the gate and reads it from the shared config', () => {
    const src = read('src/screens/Economy/WalletScreen.jsx');
    expect(src).toContain('getCreatorCapabilities');
    expect(src).toContain('LEVEL_GATES.withdrawals');
    expect(src).not.toMatch(/level\s*>=\s*\d+/);
  });

  test('the wallet read model exposes the fields the gate needs', () => {
    const src = read('src/services/walletService.js');
    expect(src).toMatch(/level:\s*Number\(userData\.level\)/);
    expect(src).toContain('isVerified');
    expect(src).toContain('isCreator');
  });
});
