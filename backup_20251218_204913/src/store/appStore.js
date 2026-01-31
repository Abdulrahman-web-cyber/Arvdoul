import { create } from "zustand";

export const useAppStore = create((set) => ({
  unreadCounts: {
    messages: 0,
    requests: 0,
    notifications: 0,
  },
  setUnreadCount: (key, count) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [key]: count,
      },
    })),
}));
