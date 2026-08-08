// Real feature flags — default safe (old behavior), canary rollout supported
export const FEATURE_FLAGS = {
  newFeedRanking: false,
  videoEditorV2: false,
  liveCoHost: false,
  aiCaptionAutoGenerate: false,
  collectionsV2: false,
  darkModeDefault: true,
};

export const isEnabled = (key) => FEATURE_FLAGS[key] === true;
export const setFlag = (key, value) => { FEATURE_FLAGS[key] = value; };
