/**
 * src/components/profile/CreatorCharts.jsx - ARVDOUL Creator Charts Component
 * 
 * Chart component for analytics visualization.
 * 
 * @component
 */

import React, { memo } from 'react';
import { cn } from '../../lib/utils';

/**
 * @typedef {Object} CreatorChartsProps
 * @property {Array} [data=[]] - Chart data
 * @property {string} [type='line'] - Chart type (line, bar)
 * @property {string} [theme='light'] - Current theme
 */
const CreatorCharts = memo(({
  data = [],
  type = 'line',
  theme = 'light',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  // Simple bar chart visualization
  const maxValue = Math.max(...data.map(d => d.value || 0), 1);

  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-12 text-xs text-gray-500 dark:text-gray-400 truncate">
            {item.label || item.date || ''}
          </span>
          <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${((item.value || 0) / maxValue) * 100}%` }}
            />
          </div>
          <span className="w-12 text-xs text-right text-gray-600 dark:text-gray-300">
            {item.value || 0}
          </span>
        </div>
      ))}
    </div>
  );
});

CreatorCharts.displayName = 'CreatorCharts';
export default CreatorCharts;
