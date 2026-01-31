\/\/ src/context/AppStoreContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import localforage from "localforage";

const AppStoreContext = createContext();

export const AppStoreProvider = ({ children }) => {
  \/\/ Global UI states
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]); \/\/ Array of { id, type, message, duration }
  const [modals, setModals] = useState({}); \/\/ Object with modalId: boolean
  const [featureFlags, setFeatureFlags] = useState({}); \/\/ Dynamic feature toggles
  const [networkStatus, setNetworkStatus] = useState(navigator.onLine);

  \/\/ -------------------- Unique ID generator --------------------
  const generateId = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  \/\/ -------------------- Toast management --------------------
  const addToast = useCallback((toast) => {
    const id = generateId();
    const duration = toast.duration || 3000;
    setToasts((prev) => [...prev, { ...toast, id, duration }]);

    \/\/ Auto-remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  \/\/ -------------------- Modal management --------------------
  const openModal = useCallback((modalId) => {
    setModals((prev) => ({ ...prev, [modalId]: true }));
  }, []);

  const closeModal = useCallback((modalId) => {
    setModals((prev) => ({ ...prev, [modalId]: false }));
  }, []);

  const toggleModal = useCallback((modalId) => {
    setModals((prev) => ({ ...prev, [modalId]: !prev[modalId] }));
  }, []);

  \/\/ -------------------- Feature flags management --------------------
  const updateFeatureFlag = useCallback(async (key, value) => {
    setFeatureFlags((prev) => {
      const updated = { ...prev, [key]: value };
      localforage.setItem("featureFlags", updated).catch((err) =>
        console.error("[AppStoreContext] Error saving feature flag:", err)
      );
      return updated;
    });
  }, []);

  const loadFeatureFlags = useCallback(async () => {
    try {
      const flags = await localforage.getItem("featureFlags");
      if (flags) setFeatureFlags(flags);
    } catch (err) {
      console.error("[AppStoreContext] Error loading feature flags:", err);
    }
  }, []);

  \/\/ -------------------- Network status listener --------------------
  useEffect(() => {
    const updateStatus = () => setNetworkStatus(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  \/\/ -------------------- Persistent app states (optional) --------------------
  \/\/ For example, store modals or toasts if needed for restoring across sessions
  useEffect(() => {
    localforage.getItem("modals").then((saved) => saved && setModals(saved));
  }, []);

  useEffect(() => {
    localforage.setItem("modals", modals).catch(console.error);
  }, [modals]);

  return (
    <AppStoreContext.Provider
      value={{
        loading,
        setLoading,
        toasts,
        addToast,
        removeToast,
        modals,
        openModal,
        closeModal,
        toggleModal,
        featureFlags,
        updateFeatureFlag,
        loadFeatureFlags,
        networkStatus,
      }}
    >
      {children}
    </AppStoreContext.Provider>
  );
};

export const useAppStore = () => useContext(AppStoreContext);