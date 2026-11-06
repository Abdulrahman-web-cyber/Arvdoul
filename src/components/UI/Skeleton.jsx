// src/components/UI/Skeleton.jsx

import { cn } from '../../lib/utils';

export const Skeleton = ({ className, ...props }) => (
  <div
    className={cn('animate-pulse bg-gray-200 dark:bg-gray-800 rounded', className)}
    {...props}
  />
);

export default Skeleton;
