// src/components/Shared/LazyImage.jsx
//
// The single image primitive for the app. A bare image element ships without a
// decode hint, without lazy loading and without a reserved box, so a long feed
// of full-resolution media blocks the main thread on decode and shifts the
// layout as each image lands (CLS). Every content image should go through this
// component so:
//   - offscreen images are deferred (`loading="lazy"`) and decoded off the
//     main thread (`decoding="async"`);
//   - an `aspectRatio` (e.g. '16 / 9', '1 / 1') reserves the box up-front, so
//     the layout does not jump when the bytes arrive;
//   - a missing or broken source renders an honest neutral placeholder — never
//     a broken-image glyph and never a fabricated photo.
//
// `loading="eager"` is opt-in for above-the-fold hero media (pass
// `loading="eager"`). Callers keep full control of `className` (sizing,
// rounding, object-fit) — the component only adds the loading behaviour.

import { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '../../lib/utils';

function Placeholder({ className, wrapperClassName }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-white/5 text-gray-500',
        wrapperClassName,
        className
      )}
      aria-hidden="true"
    >
      <ImageOff className="h-1/3 w-1/3 max-h-8 max-w-8 opacity-60" />
    </div>
  );
}

export function LazyImage({
  src,
  alt = '',
  className,
  wrapperClassName,
  aspectRatio,
  loading = 'lazy',
  decoding = 'async',
  fallback,
  onError,
  onLoad,
  ...rest
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const resolvedFallback =
    fallback ?? <Placeholder className={className} wrapperClassName={wrapperClassName} />;

  if (!src || failed) {
    return resolvedFallback;
  }

  const handleError = (event) => {
    setFailed(true);
    onError?.(event);
  };

  const image = (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      onError={handleError}
      onLoad={onLoad}
      className={className}
      {...rest}
    />
  );

  if (aspectRatio) {
    return (
      <div className={cn('overflow-hidden', wrapperClassName)} style={{ aspectRatio }}>
        {image}
      </div>
    );
  }

  return image;
}

export default LazyImage;
