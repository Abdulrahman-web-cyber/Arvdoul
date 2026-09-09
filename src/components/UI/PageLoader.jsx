// src/components/UI/PageLoader.jsx - Non-blocking top app loader banner
import React, { memo } from 'react';
import { TopAppLoadingBanner } from '../Navigation/RouteProgressBar.jsx';

export const PageLoader = memo(({ label = "Loading...", fullScreen = false }) => {
  return <TopAppLoadingBanner isAnimating={true} label={label} />;
});

PageLoader.displayName = 'PageLoader';
export default PageLoader;
