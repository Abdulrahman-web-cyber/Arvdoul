/**
 * Design-system primitives — behaviour + accessibility.
 *
 * The shared primitives in `src/design-system/` are rendered across the whole
 * app (EmptyState alone is imported by 7 screens), but only BottomNav and the
 * GlobalErrorBoundary had axe coverage. This suite renders each primitive and
 * asserts (a) the interactive contract (real <button>, loading/disabled state,
 * aria-busy, retry wiring) and (b) zero axe violations.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Button from '../design-system/Button.jsx';
import EmptyState from '../design-system/EmptyState.jsx';
import ErrorState from '../design-system/ErrorState.jsx';
import PermissionDenied from '../design-system/PermissionDenied.jsx';

expect.extend(toHaveNoViolations);

describe('Button', () => {
  test('renders a real button and has no axe violations', async () => {
    const { container } = render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('loading state sets aria-busy and blocks activation', () => {
    const onClick = jest.fn();
    render(
      <Button loading loadingLabel="Saving" onClick={onClick}>
        Save
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText('Saving')).toBeInTheDocument();
  });

  test('disabled state is inert', () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  test('announces as status with title, description and action', async () => {
    const { container } = render(
      <EmptyState title="No posts yet" description="Follow someone to fill your feed." action={<Button>Explore</Button>} />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('No posts yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ErrorState', () => {
  test('announces as alert and wires retry', async () => {
    const onRetry = jest.fn();
    const { container } = render(
      <ErrorState title="Something broke" message="Try again." onRetry={onRetry} />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  test('omits the retry button when no handler is given', () => {
    render(<ErrorState title="Nope" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('PermissionDenied', () => {
  test('announces as alert with a single labelled exit action', async () => {
    const onGoHome = jest.fn();
    const { container } = render(<PermissionDenied onGoHome={onGoHome} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go Home' }));
    expect(onGoHome).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });
});
