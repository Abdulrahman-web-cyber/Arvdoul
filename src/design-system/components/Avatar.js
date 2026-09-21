export const Avatar = ({ src, alt }) => <img src={src} alt={alt || 'Profile avatar'} aria-label={alt ? alt + ' avatar' : 'User avatar'} className="w-10 h-10 rounded-full object-cover" />;
