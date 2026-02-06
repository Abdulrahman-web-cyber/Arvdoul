// src/screens/MenuDrawer.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { X, User, Settings, HelpCircle, LogOut } from 'lucide-react';

export default function  PostOptionsDrawer({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 30 }}
        className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2">
            <button className="flex items-center space-x-3 w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <User className="w-5 h-5" />
              <span>Profile</span>
            </button>
            <button className="flex items-center space-x-3 w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
            <button className="flex items-center space-x-3 w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <HelpCircle className="w-5 h-5" />
              <span>Help & Support</span>
            </button>
            <button className="flex items-center space-x-3 w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-red-500">
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}