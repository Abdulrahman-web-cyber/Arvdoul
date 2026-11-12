/**
 * Canonical "you are not allowed to see this" surface.
 *
 * Every admin/restricted screen used to hand-roll the same "Access Denied" card
 * (three identical copies), each with a different button style. This is the one
 * implementation: a `role="alert"` region with a heading, an explanation and a
 * single safe exit action, so a denied render is announced to assistive tech and
 * looks identical everywhere.
 *
 * @param {Object} props
 * @param {string} [props.title='Access Denied']
 * @param {string} [props.message='Admin privileges required.']
 * @param {Function} [props.onGoHome] - invoked by the exit action
 * @param {string} [props.actionLabel='Go Home']
 * @param {string} [props.className]
 */

import Button from './Button.jsx';
import { Lock } from 'lucide-react';

export default function PermissionDenied({
  title = 'Access Denied',
  message = 'Admin privileges required.',
  onGoHome,
  actionLabel = 'Go Home',
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`min-h-screen flex items-center justify-center bg-gray-950 text-white ${className}`}
    >
      <div className="text-center p-8">
        <div aria-hidden="true" className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 dark:text-red-400">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-gray-400">{message}</p>
        {onGoHome && (
          <div className="mt-4 flex justify-center">
            <Button variant="primary" size="md" onClick={onGoHome}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
