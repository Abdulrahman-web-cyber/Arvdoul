// src/components/UI/PageLoader.jsx

import React, { memo } from 'react';
import { TopAppLoadingBanner } from '../Navigation/RouteProgressBar.jsx';

export const PageLoader = memo(({ label = "Loading...", fullScreen = false }) => {
  return <TopAppLoadingBanner isAnimating={true} label={label} />;
});

PageLoader.displayName = 'PageLoader';
export default PageLoader;
