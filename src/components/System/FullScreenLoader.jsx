// src/components/System/FullScreenLoader.jsx
import React from "react";
import PropTypes from "prop-types";
import { TopAppLoadingBanner } from "../Navigation/RouteProgressBar.jsx";

export default function FullScreenLoader({ 
  message = "Loading...", 
  progress = null,
  phase = null,
  showSpinner = true 
}) {
  return <TopAppLoadingBanner isAnimating={true} label={message} />;
}

FullScreenLoader.propTypes = {
  message: PropTypes.string,
  progress: PropTypes.number,
  phase: PropTypes.string,
  showSpinner: PropTypes.bool
};