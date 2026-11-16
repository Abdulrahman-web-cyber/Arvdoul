// src/screens/Admin/AdminSupportTicketsScreen.jsx

import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { MessageCircle, Search, Send, User, Bot, ChevronRight, X } from "lucide-react";
import { useAuth } from '../../context/AuthContext';
import { supportAutomationService } from '../../services/supportAutomationService.js';
import { callFunction, FUNCTIONS, fetchAdminStatus } from '../../services/callableService.js';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const AdminSupportTicketsScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [statusFilter, setStatusFilter] = useState('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    const loadTickets = async () => {
      try {
        if (!user?.uid || !(await fetchAdminStatus())) {
          setDenied(true);
          setLoading(false);
          return;
        }
        const res = await callFunction(FUNCTIONS.ADMIN_LIST_SUPPORT_TICKETS, { limit: 50 });
        setTickets(Array.isArray(res?.tickets) ? res.tickets : []);
      } catch {
        toast.error('Could not load the support queue.');
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    loadTickets();
  }, [user?.uid]);

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;

    const reply = replyMessage.trim();
    try {
      await callFunction(FUNCTIONS.ADMIN_RESOLVE_SUPPORT_TICKET, {
        ticketId: selectedTicket.id,
        reply,
        status: 'resolved',
      });

      const messages = [
        ...(selectedTicket.messages || []),
        { sender: 'agent', text: reply, timestamp: new Date().toISOString() },
      ];
      const updated = { ...selectedTicket, status: 'resolved', messages };
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
      setSelectedTicket(updated);
      setReplyMessage('');

      toast.success('Reply dispatched. Ticket marked as resolved.');
    } catch {
      toast.error('Could not save the reply.');
    }
  };

  const handleAutoSuggest = () => {
    if (!selectedTicket || !selectedTicket.messages?.length) return;
    const triage = supportAutomationService.triageSupportTicket(selectedTicket.messages[0].text);
    if (triage.response) {
      setReplyMessage(triage.response);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(t.subject || '').toLowerCase().includes(q) ||
      String(t.userName || '').toLowerCase().includes(q) ||
      String(t.userEmail || '').toLowerCase().includes(q) ||
      String(t.id || '').toLowerCase().includes(q)
    );
  });

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div id="admin-support-screen" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="Support Ticket Center"
        subtitle="Inquiry resolution, user assistance, and automated triage routing"
        actions={
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {['open', 'in_progress', 'resolved', 'all'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize whitespace-nowrap shrink-0 transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              aria-label="Search user, subject, or email"
              type="text"
              placeholder="Search user, subject, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium tabular-nums">
            {filteredTickets.length} tickets in queue
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {!loading && filteredTickets.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
                {tickets.length === 0
                  ? 'No support tickets have been submitted yet.'
                  : 'No tickets match this filter.'}
              </div>
            )}
            {filteredTickets.map((tkt) => (
              <button
                key={tkt.id}
                type="button"
                onClick={() => setSelectedTicket(tkt)}
                className="w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition cursor-pointer"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`p-2.5 rounded-lg shrink-0 ${
                      tkt.priority === 'high'
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">{tkt.subject}</span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">#{tkt.id}</span>
                      {tkt.autoResolved && (
                        <>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <Bot className="w-3.5 h-3.5" /> Auto-Resolved
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{tkt.userName} ({tkt.userEmail})</span>
                      <span aria-hidden="true">·</span>
                      <span>Category: <strong className="text-slate-700 dark:text-slate-300 capitalize">{String(tkt.category || 'uncategorised').replace('_', ' ')}</strong></span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold capitalize ${
                      tkt.status === 'resolved'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : tkt.status === 'in_progress'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {String(tkt.status || 'open').replace('_', ' ')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-base text-slate-900 dark:text-white truncate">{selectedTicket.subject}</h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums truncate">
                  #{selectedTicket.id} · {selectedTicket.userName} ({selectedTicket.userEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                aria-label="Close ticket dialog"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {selectedTicket.messages?.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl text-xs sm:text-sm ${
                    msg.sender === 'user'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 mr-8'
                      : msg.sender === 'ai_bot'
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ml-8 border border-blue-200 dark:border-blue-900'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 ml-8'
                  }`}
                >
                  <div className="font-semibold mb-1 flex items-center gap-1.5">
                    {msg.sender === 'ai_bot' ? (
                      <>
                        <Bot className="w-3.5 h-3.5" />
                        <span>Arvdoul Support AI</span>
                      </>
                    ) : msg.sender === 'agent' ? (
                      <>
                        <User className="w-3.5 h-3.5" />
                        <span>Support Specialist</span>
                      </>
                    ) : (
                      <span>{selectedTicket.userName}</span>
                    )}
                  </div>
                  <p>{msg.text}</p>
                </div>
              ))}
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Compose Official Response</span>
                <button
                  type="button"
                  onClick={handleAutoSuggest}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Insert Triage Draft</span>
                </button>
              </div>

              <textarea
                aria-label="Official support response"
                rows={3}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type resolution details to send to user..."
                className="w-full p-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
              />

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch &amp; Resolve</span>
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
