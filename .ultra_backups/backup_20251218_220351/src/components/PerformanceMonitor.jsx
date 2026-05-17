// src/components/PerformanceMonitor.jsx
import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Wifi, WifiOff } from 'lucide-react';

const PerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    fps: 60,
    memory: 0,
    network: 'online',
    longTasks: 0,
    renderTime: 0
  });
  
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    // FPS monitoring
    let frameCount = 0;
    let lastTime = performance.now();
    
    const checkFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setMetrics(prev => ({ ...prev, fps: frameCount }));
        frameCount = 0;
        lastTime = currentTime;
      }
      requestAnimationFrame(checkFPS);
    };
    
    // Memory monitoring
    const checkMemory = () => {
      if ('memory' in performance) {
        setMetrics(prev => ({ 
          ...prev, 
          memory: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) 
        }));
      }
    };
    
    // Network monitoring
    const handleNetworkChange = () => {
      setMetrics(prev => ({ 
        ...prev, 
        network: navigator.onLine ? 'online' : 'offline' 
      }));
    };
    
    // Long task monitoring
    const observer = new PerformanceObserver((list) => {
      const longTasks = list.getEntries().filter(entry => entry.duration > 50).length;
      setMetrics(prev => ({ ...prev, longTasks }));
    });
    
    // Start monitoring
    const fpsId = requestAnimationFrame(checkFPS);
    const memoryInterval = setInterval(checkMemory, 2000);
    
    observer.observe({ entryTypes: ['longtask'] });
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    
    return () => {
      cancelAnimationFrame(fpsId);
      clearInterval(memoryInterval);
      observer.disconnect();
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, []);
  
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-surface-800 text-surface-100 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
        title="Show performance monitor"
      >
        <Activity className="w-5 h-5" />
      </button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-surface-800/90 backdrop-blur-sm text-surface-100 rounded-xl p-4 shadow-2xl max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Performance Monitor
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-surface-400 hover:text-surface-100"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-300">FPS</span>
          <span className={`font-mono ${metrics.fps < 30 ? 'text-error-400' : metrics.fps < 50 ? 'text-warning-400' : 'text-success-400'}`}>
            {metrics.fps}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-300 flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            Memory
          </span>
          <span className="font-mono">
            {metrics.memory}MB
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-300 flex items-center gap-1">
            {metrics.network === 'online' ? (
              <Wifi className="w-3 h-3 text-success-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-error-400" />
            )}
            Network
          </span>
          <span className={`font-mono ${metrics.network === 'online' ? 'text-success-400' : 'text-error-400'}`}>
            {metrics.network}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-300 flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            Long Tasks
          </span>
          <span className={`font-mono ${metrics.longTasks > 0 ? 'text-warning-400' : 'text-success-400'}`}>
            {metrics.longTasks}
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-surface-700">
        <button
          onClick={() => window.location.reload()}
          className="w-full py-1 px-2 text-xs bg-surface-700 hover:bg-surface-600 rounded transition-colors"
        >
          Force GC & Refresh
        </button>
      </div>
    </div>
  );
};

export default PerformanceMonitor;