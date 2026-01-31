export const useAnalytics = () => {
  const track = (event, data) => {
    // Replace this with Firebase Analytics or your own logger
    console.log(`📊 Tracking Event: ${event}`, data);
  };

  return { track };
};
