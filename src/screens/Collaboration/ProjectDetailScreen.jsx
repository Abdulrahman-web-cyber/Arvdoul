// src/screens/Collaboration/ProjectDetailScreen.jsx - ARVDOUL PROJECT DETAIL
// Per Constitution v5.0 - Team, content versions, review workflow
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../../lib/utils';
import collaborationService from '../../services/collaborationService';
import { 
  ArrowLeft, Users, Clock, FileText, CheckCircle, XCircle, 
  MessageCircle, Share2, MoreVertical, Plus, Eye, Download, Loader2
} from 'lucide-react';

const STATUS_CONFIG = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: FileText },
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
  review: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Eye },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
};

export default function ProjectDetailScreen() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState('content');
  const [project, setProject] = useState(null);
  const [team, setTeam] = useState([]);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const projectData = await collaborationService.getProject(projectId);
        const teamData = await collaborationService.getTeam(projectId);
        const contentData = await collaborationService.getContentVersions(projectId);
        
        setProject(projectData);
        setTeam(teamData || []);
        setContent(contentData || []);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadProject();
  }, [projectId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={backgroundStyle}>
        <Loader2 className="w-8 h-8 animate-spin text-arvdoul-purple" />
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={backgroundStyle}>
        <p className="text-red-400 mb-4">{error || 'Project not found'}</p>
        <button 
          onClick={() => navigate('/collaboration')}
          className="px-4 py-2 rounded-lg bg-arvdoul-purple text-white"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const backgroundStyle = useMemo(() => ({
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.1) 0%, transparent 50%), #03071B'
      : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.05) 0%, transparent 50%), #F6F8FC',
  }), [isDark]);

  const tabs = [
    { id: 'content', label: 'Content', count: project.content.length },
    { id: 'team', label: 'Team', count: project.team.length },
    { id: 'reviews', label: 'Reviews', count: project.reviews.length },
  ];

  return (
    <div className="min-h-screen pb-20" style={backgroundStyle}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
      >
        {/* Cover Image */}
        <div className="h-48 relative">
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* More Options */}
          <button className="absolute top-4 right-4 p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Project Info */}
        <div className="px-4 -mt-12 relative z-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-white mb-1">
                {project.name}
              </h1>
              <p className="text-sm text-gray-300">{project.description}</p>
            </div>
            <div className={cn(
              "px-3 py-1 rounded-full text-sm font-medium",
              STATUS_CONFIG[project.status]?.bg || 'bg-gray-500/20',
              STATUS_CONFIG[project.status]?.text || 'text-gray-400'
            )}>
              {project.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
          
          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Updated {project.updatedAt}
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {team.length} members
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className={cn(
          "flex gap-1 p-1 rounded-arvdoul-lg",
          isDark ? "bg-white/5" : "bg-gray-100"
        )}>
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-2 px-3 rounded-arvdoul-md text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-arvdoul-gradient text-white"
                  : isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
              )}
            >
              {tab.label} ({tab.count})
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4">
        {activeTab === 'content' && (
          <div className="space-y-3">
            {content.map((item, index) => {
              const status = STATUS_CONFIG[item.status];
              const StatusIcon = status?.icon || FileText;
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-arvdoul-lg",
                    "bg-arvdoul-surface border border-arvdoul-border"
                  )}
                >
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-white">{item.title}</h4>
                    <p className="text-xs text-gray-400 capitalize">{item.type} • {item.updatedAt}</p>
                  </div>
                  <div className={cn("flex items-center gap-1", status?.text)}>
                    <StatusIcon className="w-4 h-4" />
                  </div>
                </motion.div>
              );
            })}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full py-3 rounded-arvdoul-lg border border-dashed border-arvdoul-border",
                "text-arvdoul-text-secondary hover:text-white hover:border-arvdoul-purple/50",
                "flex items-center justify-center gap-2 transition-all"
              )}
            >
              <Plus className="w-5 h-5" />
              Add Content
            </motion.button>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-3">
            {project.team.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-arvdoul-lg",
                  "bg-arvdoul-surface border border-arvdoul-border"
                )}
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <h4 className="font-medium text-white">{member.name}</h4>
                  <p className="text-sm text-gray-400">{member.email}</p>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs",
                  member.role === 'Owner' ? "bg-arvdoul-purple/20 text-arvdoul-purple" : "bg-gray-500/20 text-gray-400"
                )}>
                  {member.role}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-3">
            {project.reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "p-4 rounded-arvdoul-lg",
                  "bg-arvdoul-surface border border-arvdoul-border"
                )}
              >
                <div className="flex items-start gap-3 mb-2">
                  <img
                    src={review.avatar}
                    alt={review.user}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-white">{review.user}</h4>
                      <span className="text-xs text-gray-500">{review.time}</span>
                    </div>
                    {review.status === 'approved' && (
                      <span className="text-xs text-green-400">Approved</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-300 pl-11">{review.comment}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
