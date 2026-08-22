// src/screens/Collaboration/ProjectDashboardScreen.jsx - ARVDOUL PROJECT DASHBOARD
// Per Constitution v5.0 - Grid of collaboration projects
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../../lib/utils';
import collaborationService from '../../services/collaborationService';
import { Plus, Folder, Clock, Users, MoreVertical, Search, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Draft' },
  in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'In Progress' },
  review: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Review' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
};

export default function ProjectDashboardScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProjects = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // Get user's collaboration stats which includes their projects
        const stats = await collaborationService.getStats(user.uid);
        setProjects(stats?.projects || []);
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadProjects();
  }, [user?.uid]);

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = (project.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const backgroundStyle = useMemo(() => ({
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.1) 0%, transparent 50%), #03071B'
      : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.05) 0%, transparent 50%), #F6F8FC',
  }), [isDark]);

  return (
    <div className="min-h-screen pb-20" style={backgroundStyle}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className={cn("p-2 rounded-full", isDark ? "hover:bg-white/10" : "hover:bg-black/5")}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className={cn("text-2xl font-display font-bold", isDark ? "text-white" : "text-gray-900")}>
              Projects
            </h1>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 rounded-arvdoul-md bg-arvdoul-gradient text-white font-medium shadow-arvdoul-button"
          >
            <Plus className="w-5 h-5" />
            New Project
          </motion.button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className={cn(
            "flex-1 flex items-center gap-2 px-4 py-2 rounded-arvdoul-md",
            "bg-arvdoul-surface border border-arvdoul-border"
          )}>
            <Search className="w-5 h-5 text-arvdoul-text-secondary" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder:text-arvdoul-text-secondary outline-none"
            />
          </div>
          <button className={cn(
            "p-3 rounded-arvdoul-md",
            "bg-arvdoul-surface border border-arvdoul-border"
          )}>
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </motion.div>

      {/* Projects Grid */}
      <div className="px-4">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-arvdoul-purple" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">Failed to load projects: {error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-arvdoul-purple text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <Folder className="w-12 h-12 mx-auto text-arvdoul-text-secondary mb-4" />
            <p className="text-arvdoul-text-secondary mb-2">No projects yet</p>
            <p className="text-sm text-arvdoul-text-secondary/70">Create your first collaboration project</p>
          </div>
        )}

        {/* Projects Grid */}
        {!loading && !error && filteredProjects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProjects.map((project, index) => {
            const status = STATUS_COLORS[project.status] || STATUS_COLORS.draft;
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className={cn(
                  "rounded-arvdoul-xl overflow-hidden",
                  "bg-arvdoul-surface border border-arvdoul-border",
                  "cursor-pointer transition-all duration-300"
                )}
                onClick={() => navigate(`/collaboration/${project.id}`)}
              >
                {/* Thumbnail */}
                <div className="h-32 relative">
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-800/70 via-indigo-800/70 to-blue-900/70 flex items-center justify-center">
                      <Folder className="w-10 h-10 text-white/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  
                  {/* Status Badge */}
                  <div className={cn(
                    "absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium",
                    status.bg, status.text
                  )}>
                    {status.label}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-1">{project.name}</h3>
                  <p className="text-sm text-arvdoul-text-secondary mb-3 line-clamp-1">
                    {project.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    {/* Team Avatars */}
                    <div className="flex -space-x-2">
                      {(project.team || []).slice(0, 3).map((member) => (
                        member?.avatar ? (
                          <img
                            key={member.id}
                            src={member.avatar}
                            alt="Team member"
                            className="w-7 h-7 rounded-full border-2 border-arvdoul-surface"
                          />
                        ) : (
                          <div
                            key={member?.id || Math.random()}
                            className="w-7 h-7 rounded-full bg-arvdoul-purple flex items-center justify-center text-xs text-white border-2 border-arvdoul-surface"
                          >
                            {(member?.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )
                      ))}
                      {(project.members || 0) > 3 && (
                        <div className="w-7 h-7 rounded-full bg-arvdoul-purple flex items-center justify-center text-xs text-white border-2 border-arvdoul-surface">
                          +{(project.members || 0) - 3}
                        </div>
                      )}
                    </div>
                    
                    {/* Updated */}
                    <div className="flex items-center gap-1 text-xs text-arvdoul-text-secondary">
                      <Clock className="w-3 h-3" />
                      {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
