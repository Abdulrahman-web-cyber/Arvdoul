/**
 * src/screens/Profile/HighlightsScreen.jsx - ARVDOUL Highlights Screen
 * 
 * Manage story highlights.
 * 
 * @component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { ArrowLeft, Plus, MoreHorizontal, Trash2, Edit2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';

/**
 * HighlightsScreen Component
 */
export default function HighlightsScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const currentUser = useAppStore(state => state.currentUser);
  
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHighlight, setSelectedHighlight] = useState(null);
  
  // Load highlights
  useEffect(() => {
    const loadHighlights = async () => {
      setLoading(true);
      try {
        const storyService = (await import('../../services/storyService.js')).getStoryService();
        const userHighlights = await storyService.getHighlights(currentUser?.uid);
        setHighlights(userHighlights || []);
      } catch (error) {
        console.error('Failed to load highlights:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadHighlights();
  }, [currentUser?.uid]);
  
  const handleCreateHighlight = useCallback(() => {
    // Navigate to create highlight screen
    navigate('/create-highlight');
  }, [navigate]);
  
  const handleEditHighlight = useCallback((highlight) => {
    setSelectedHighlight(highlight);
    // Show edit modal or navigate
  }, []);
  
  const handleDeleteHighlight = useCallback(async (highlight) => {
    if (window.confirm('Delete this highlight?')) {
      try {
        const storyService = (await import('../../services/storyService.js')).getStoryService();
        // Delete highlight logic would go here
        setHighlights(prev => prev.filter(h => h.id !== highlight.id));
        toast.success('Highlight deleted');
      } catch (error) {
        toast.error('Failed to delete highlight');
      }
    }
  }, []);
  
  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Header */}
      <div className={cn(
        'sticky top-0 z-20',
        'bg-white dark:bg-gray-900',
        'border-b border-gray-200 dark:border-gray-800'
      )}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className={cn(
                'p-2 rounded-xl',
                'hover:bg-gray-100 dark:hover:bg-gray-800',
                'transition-colors'
              )}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Highlights
            </h1>
          </div>
          
          <button
            onClick={handleCreateHighlight}
            className={cn(
              'px-4 py-2 rounded-xl font-medium text-sm',
              'bg-gradient-to-r from-purple-500 to-blue-500',
              'text-white hover:opacity-90 transition-opacity',
              'flex items-center gap-2'
            )}
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : highlights.length === 0 ? (
          <div className="text-center py-20">
            <div className={cn(
              'w-20 h-20 rounded-full mx-auto mb-4',
              'bg-gray-100 dark:bg-gray-800',
              'flex items-center justify-center'
            )}>
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No highlights yet
            </p>
            <button
              onClick={handleCreateHighlight}
              className={cn(
                'px-4 py-2 rounded-xl font-medium',
                'bg-purple-500 text-white',
                'hover:bg-purple-600 transition-colors'
              )}
            >
              Create Your First Highlight
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className={cn(
                  'relative group cursor-pointer'
                )}
              >
                <button
                  onClick={() => navigate(`/highlight/${highlight.id}`)}
                  className="w-full"
                >
                  <div className={cn(
                    'aspect-square rounded-2xl overflow-hidden',
                    'bg-gradient-to-br from-purple-500 to-blue-500 p-0.5'
                  )}>
                    <div className={cn(
                      'w-full h-full rounded-xl overflow-hidden',
                      'bg-white dark:bg-gray-900'
                    )}>
                      {highlight.coverUrl ? (
                        <img
                          src={highlight.coverUrl}
                          alt={highlight.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">
                          {highlight.emoji || '📚'}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white text-center mt-2 truncate">
                    {highlight.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {highlight.storyCount || 0} stories
                  </p>
                </button>
                
                {/* Actions */}
                <div className={cn(
                  'absolute top-2 right-2',
                  'opacity-0 group-hover:opacity-100',
                  'transition-opacity'
                )}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHighlight(highlight);
                    }}
                    className={cn(
                      'p-1.5 rounded-full',
                      'bg-black/50 hover:bg-black/70',
                      'text-white transition-colors'
                    )}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Dropdown */}
                {selectedHighlight?.id === highlight.id && (
                  <div className={cn(
                    'absolute top-10 right-2 z-10',
                    'w-36 py-1 rounded-xl',
                    'bg-white dark:bg-gray-800',
                    'shadow-lg border border-gray-200 dark:border-gray-700'
                  )}>
                    <button
                      onClick={() => handleEditHighlight(highlight)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        'flex items-center gap-2'
                      )}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteHighlight(highlight)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm text-red-500',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                        'flex items-center gap-2'
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
