// src/App.jsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './context/ThemeContext';
import { SignupProvider } from './context/SignupContext';
import AppRoutes from './routes/AppRoutes';

// Import global styles
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SignupProvider>
          {/* Main App Content */}
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <AppRoutes />
          </div>
          
          {/* Toast Notifications */}
          <Toaster 
            position="top-right"
            toastOptions={{
              className: 'font-sans',
              style: {
                background: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              },
            }}
            expand={true}
            richColors
            closeButton
          />
          
          {/* Security Watermark (only in production) */}
          {process.env.NODE_ENV === 'production' && (
            <div className="fixed bottom-4 right-4 text-xs text-gray-400 dark:text-gray-600 opacity-50 pointer-events-none">
              Arvdoul v1.0 • Security Level: MAX
            </div>
          )}
        </SignupProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;