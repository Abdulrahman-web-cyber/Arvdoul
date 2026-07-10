/**
 * src/components/profile/CreatorCharts.jsx - ARVDOUL Creator Charts Component
 * 
 * Visual charts for analytics data.
 * 
 * @component
 */

import React, { memo, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, BarChart2 } from 'lucide-react';

/**
 * Simple bar chart component
 */
const BarChart = ({ data = [], height = 120, theme = 'light' }) => {
  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.value), 1);
  }, [data]);

  const barWidth = useMemo(() => {
    return data.length > 0 ? `${100 / data.length}%` : '20px';
  }, [data]);

  return (
    <div 
      className="flex items-end justify-between gap-1"
      style={{ height }}
    >
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * 100;
        return (
          <div
            key={index}
            className="flex-1 flex flex-col items-center justify-end"
            style={{ maxWidth: barWidth }}
          >
            <div
              className={cn(
                'w-full rounded-t-sm transition-all',
                'bg-gradient-to-t from-purple-500 to-blue-500',
                'hover:from-purple-400 hover:to-blue-400'
              )}
              style={{ height: `${Math.max(barHeight, 5)}%` }}
              title={`${item.label}: ${item.value}`}
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * Simple line chart component
 */
const LineChart = ({ data = [], height = 120, theme = 'light' }) => {
  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.value), 1);
  }, [data]);

  const points = useMemo(() => {
    if (data.length === 0) return '';
    
    return data.map((item, index) => {
      const x = (index / (data.length - 1 || 1)) * 100;
      const y = 100 - (item.value / maxValue) * 100;
      return `${x},${y}`;
    }).join(' ');
  }, [data, maxValue]);

  const areaPoints = useMemo(() => {
    if (data.length === 0) return '';
    return `0,100 ${points} 100,100`;
  }, [points, data]);

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B416DB" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4B6BFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <polygon
          points={areaPoints}
          fill="url(#chartGradient)"
        />
        
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        
        {/* Gradient for line */}
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#B416DB" />
            <stop offset="50%" stopColor="#872FE2" />
            <stop offset="100%" stopColor="#4B6BFF" />
          </linearGradient>
        </defs>
        
        {/* Dots */}
        {data.map((item, index) => {
          const x = (index / (data.length - 1 || 1)) * 100;
          const y = 100 - (item.value / maxValue) * 100;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2"
              fill="#B416DB"
              className="hover:r-3 transition-all"
            />
          );
        })}
      </svg>
    </div>
  );
};

/**
 * CreatorCharts Component
 * @param {Object} props
 */
const CreatorCharts = ({
  dailyStats = [],
  theme = 'light',
  type = 'bar', // 'bar' | 'line'
}) => {
  // Process data for charts
  const chartData = useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) {
      // Generate sample data
      const sampleData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        sampleData.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          views: Math.floor(Math.random() * 1000) + 500,
          engagement: Math.floor(Math.random() * 100) + 50,
        });
      }
      return sampleData;
    }
    
    return dailyStats.slice(-7).map(stat => ({
      date: new Date(stat.date).toLocaleDateString('en-US', { weekday: 'short' }),
      views: stat.views || 0,
      engagement: stat.engagement || 0,
    }));
  }, [dailyStats]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className={cn(
        'p-6 rounded-xl',
        'bg-gray-50 dark:bg-gray-800/50',
        'text-center'
      )}>
        <BarChart2 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No chart data available
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      'p-4 rounded-xl',
      'bg-white dark:bg-gray-900',
      'border border-gray-200 dark:border-gray-800'
    )}>
      {/* Views Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-500" />
          Views (Last 7 Days)
        </h4>
        {type === 'line' ? (
          <LineChart 
            data={chartData.map(d => ({ label: d.date, value: d.views }))}
            theme={theme}
          />
        ) : (
          <BarChart 
            data={chartData.map(d => ({ label: d.date, value: d.views }))}
            theme={theme}
          />
        )}
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          {chartData.map((d, i) => (
            <span key={i}>{d.date}</span>
          ))}
        </div>
      </div>
      
      {/* Engagement Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-pink-500" />
          Engagement (Last 7 Days)
        </h4>
        {type === 'line' ? (
          <LineChart 
            data={chartData.map(d => ({ label: d.date, value: d.engagement }))}
            theme={theme}
          />
        ) : (
          <BarChart 
            data={chartData.map(d => ({ label: d.date, value: d.engagement }))}
            theme={theme}
          />
        )}
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          {chartData.map((d, i) => (
            <span key={i}>{d.date}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(CreatorCharts);
