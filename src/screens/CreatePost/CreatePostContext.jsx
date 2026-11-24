// src/screens/CreatePost/CreatePostContext.jsx
import { createContext, useContext } from 'react';

export const ServicesContext = createContext(null);
export const StateContext = createContext(null);

export const useCreatePostServices = () => {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useCreatePostServices must be used within CreatePostProvider');
  return ctx;
};

export const useCreatePostState = () => {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useCreatePostState must be used within CreatePostProvider');
  return ctx;
};
