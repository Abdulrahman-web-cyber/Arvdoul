// src/context/LayoutChromeContext.jsx
// Shared layout chrome context so route screens know whether MainLayout's
// TopAppBar is mounted and avoid rendering duplicate stacked headers.

import { createContext, useContext } from 'react';

const LayoutChromeContext = createContext({
  hasTopAppBar: false,
});

export function LayoutChromeProvider({ hasTopAppBar = false, children }) {
  return (
    <LayoutChromeContext.Provider value={{ hasTopAppBar }}>
      {children}
    </LayoutChromeContext.Provider>
  );
}

export function useLayoutChrome() {
  return useContext(LayoutChromeContext);
}

export default LayoutChromeContext;
