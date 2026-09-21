// src/screens/Admin/AdminSupportTicketsScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  MessageCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  User,
  Bot,
  Sparkles,
  ChevronRight,
  X,
  Mail,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supportAutomationService } from '../../services/supportAutomationService.js';
import { auditLogger } from '../../utils/AuditLogger.js';

const AdminSupportTicketsScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open'); // 'all' | 'open' | 'in_progress' | 'resolved'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Tickets are loaded from Firestore; no local seed data is ever shown.
  const [tickets, setTickets] = useState([]);

  // Load live tickets if collection exists
  useEffect(() => {
    const loadTickets = async () => {
      try {
        const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
        const { getFirestoreInstance } = await import('../../firebase/firebase.js');
        const firestore = await getFirestoreInstance();

        const snap = await getDocs(
          query(collection(firestore, 'support_tickets'), orderBy('createdAt', 'desc'), limit(50))
        );
        setTickets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        toast.error('Could not load support tickets.');
      } finally {
        setLoading(false);
      }
    };
    loadTickets();
  }, []);

  // Send agent reply
  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    const newMsg = {
      sender: 'agent',
      text: replyMessage.trim(),
      timestamp: new Date().toISOString(),
      agentEmail: user?.email || null,
      agentId: user?.uid || null,
    };

    setSending(true);
    try {
      const { doc, updateDoc, arrayUnion, serverTimestamp } = await import('firebase/firestore');
      const { getFirestoreInstance } = await import('../../firebase/firebase.js');
      const firestore = await getFirestoreInstance();

      await updateDoc(doc(firestore, 'support_tickets', selectedTicket.id), {
        status: 'resolved',
        messages: arrayUnion(newMsg),
        updatedAt: serverTimestamp(),
      });

      const updated = {
        ...selectedTicket,
        status: 'resolved',
        messages: [...(selectedTicket.messages || []), newMsg],
      };
      setTickets(prev => prev.map(t => (t.id === selectedTicket.id ? updated : t)));
      setSelectedTicket(updated);
      setReplyMessage('');

      await auditLogger.log(user?.uid || 'admin', 'SUPPORT_TICKET_RESOLVED', {
        ticketId: selectedTicket.id,
        userEmail: selectedTicket.userEmail,
        agentEmail: user?.email || null,
      });

      toast.success('Reply sent. Ticket marked as resolved.');
    } catch (error) {
      toast.error(error?.message || 'Could not send the reply.');
    } finally {
      setSending(false);
    }
  };

  // Quick auto-resolution helper
  const handleAutoSuggest = () => {
    if (!selectedTicket || !selectedTicket.messages?.length) return;
    const triage = supportAutomationService.triageSupportTicket(selectedTicket.messages[0].text);
    if (triage.response) {
      setReplyMessage(triage.response);
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q) ||
      t.userEmail.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  });

  return (
    <div id="admin-support-screen" className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              id="back-btn-support"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Back to Admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Support Ticket Center</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5" />
                  AI Triage Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Inquiry resolution, user assistance, and automated triage routing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-750 p-1 rounded-xl">
            {['open', 'in_progress', 'resolved', 'all'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  statusFilter === status
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user, subject, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="text-xs text-gray-500 font-medium">
            {filteredTickets.length} tickets in queue
          </div>
        </div>

        {/* Tickets List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 flex items-center justify-center text-gray-400">
              <Clock className="w-5 h-5 animate-pulse" />
              <span className="ml-3 text-sm">Loading tickets…</span>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
              <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              No tickets match this filter.
            </div>
          ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredTickets.map(tkt => (
              <div
                key={tkt.id}
                onClick={() => setSelectedTicket(tkt)}
                className="p-5 flex items-center justify-between gap-4 hover:bg-gray-50/70 dark:hover:bg-gray-750 transition cursor-pointer"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl ${
                      tkt.priority === 'high'
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">{tkt.subject}</span>
                      <span className="text-xs text-gray-400 font-mono">#{tkt.id}</span>
                      {tkt.autoResolved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <Bot className="w-3 h-3" /> Auto-Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                      <span>{tkt.userName} ({tkt.userEmail})</span>
                      <span>•</span>
                      <span>Category: <b className="text-gray-700 dark:text-gray-300 capitalize">{tkt.category.replace('_', ' ')}</b></span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                      tkt.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : tkt.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }`}
                  >
                    {tkt.status.replace('_', ' ')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Ticket Inspection & Reply Drawer/Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">{selectedTicket.subject}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  #{selectedTicket.id} • {selectedTicket.userName} ({selectedTicket.userEmail})
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conversation Log */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {selectedTicket.messages?.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl text-xs sm:text-sm ${
                    msg.sender === 'user'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 ml-0 mr-8'
                      : msg.sender === 'ai_bot'
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200 ml-8 mr-0 border border-indigo-200 dark:border-indigo-800'
                      : 'bg-blue-600 text-white ml-8 mr-0'
                  }`}
                >
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    {msg.sender === 'ai_bot' ? (
                      <>
                        <Bot className="w-3.5 h-3.5" />
                        <span>Arvdoul Support AI</span>
                      </>
                    ) : msg.sender === 'agent' ? (
                      <>
                        <User className="w-3.5 h-3.5" />
                        <span>Support Specialist ({msg.agentEmail})</span>
                      </>
                    ) : (
                      <span>{selectedTicket.userName}</span>
                    )}
                  </div>
                  <p>{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Response Composer */}
            <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">Compose Official Response</span>
                <button
                  type="button"
                  onClick={handleAutoSuggest}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Insert AI Suggestion</span>
                </button>
              </div>

              <textarea
                rows={3}
                value={replyMessage}
                onChange={e => setReplyMessage(e.target.value)}
                placeholder="Type resolution details to send to user..."
                className="w-full p-3 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
                >
                  Close
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || sending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Sending…' : 'Dispatch & Resolve'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminSupportTicketsScreen;
