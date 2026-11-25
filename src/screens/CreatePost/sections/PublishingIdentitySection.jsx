// src/screens/CreatePost/sections/PublishingIdentitySection.jsx
import { useState } from 'react';
import * as Icons from 'lucide-react';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useCreatePostServices, useCreatePostState } from '../CreatePostContext.jsx';
import { INPUT_CLASS, SURFACE_GLASS_CLASS } from '../createPostConstants.js';
import { pickDisplayName, deriveHandle } from '../../../services/profileReadModel.js';
import { LazyImage } from '../../../components/Shared/LazyImage.jsx';

const IDENTITY_MODES = [
  { id: 'personal', label: 'Personal Profile' },
  { id: 'creator', label: 'Creator Channel' },
  { id: 'community', label: 'Community Context' },
];

export default function PublishingIdentitySection() {
  const { user } = useAuth();
  const { state, dispatch } = useCreatePostState();
  const { searchUsers } = useCreatePostServices();
  const [collabQuery, setCollabQuery] = useState('');
  const [collabResults, setCollabResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const meta = state.identityMeta || {};
  const collaborators = Array.isArray(meta.collaborators) ? meta.collaborators : [];
  const authorName = pickDisplayName([user?.displayName, user?.username], { fallback: 'You' });
  const handle = deriveHandle(user?.username) || deriveHandle(user?.email) || 'citizen';

  const handleSearch = async (val) => {
    setCollabQuery(val);
    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setCollabResults([]);
      return;
    }
    setSearching(true);
    try {
      const users = await searchUsers(trimmed);
      setCollabResults(
        (users || []).filter(
          (u) => u?.uid !== user?.uid && !collaborators.some((c) => c.uid === u.uid)
        )
      );
    } catch (err) {
      console.warn('[PublishingIdentitySection] Collaborator search failed:', err?.message);
      setCollabResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addCollaborator = (u) => {
    const next = [
      ...collaborators,
      {
        uid: u.uid || u.id,
        displayName: u.displayName || u.name || u.username || 'Collaborator',
        username: u.username || '',
      },
    ].slice(0, 10);
    dispatch({ type: 'SET_IDENTITY_META', payload: { collaborators: next } });
    setCollabQuery('');
    setCollabResults([]);
  };

  const removeCollaborator = (uid) => {
    dispatch({
      type: 'SET_IDENTITY_META',
      payload: { collaborators: collaborators.filter((c) => c.uid !== uid) },
    });
  };

  return (
    <section
      id="composer-section-identity"
      aria-labelledby="heading-identity"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
            02
          </span>
          <div>
            <h3 id="heading-identity" className="text-sm font-semibold text-slate-900 dark:text-white">
              Publishing Identity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Author context, co-authors, and destination
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10">
        {user?.photoURL ? (
          <LazyImage
            src={user.photoURL}
            alt={authorName}
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-arvdoul-purple/20 text-arvdoul-purple flex items-center justify-center font-bold text-sm shrink-0">
            {authorName[0]?.toUpperCase() || 'U'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{authorName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{handle}</p>
        </div>
      </div>

      <div>
        <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
          Publish as
        </span>
        <div className="grid grid-cols-3 gap-2">
          {IDENTITY_MODES.map((mode) => {
            const active = (meta.publishAs || 'personal') === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => dispatch({ type: 'SET_IDENTITY_META', payload: { publishAs: mode.id } })}
                className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-arvdoul-purple text-white border-arvdoul-purple'
                    : 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {meta.publishAs === 'community' && (
        <div>
          <label
            htmlFor="identity-community-id"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
          >
            Community Destination ID (optional)
          </label>
          <input
            id="identity-community-id"
            type="text"
            value={meta.communityDestinationId || ''}
            onChange={(e) =>
              dispatch({
                type: 'SET_IDENTITY_META',
                payload: { communityDestinationId: e.target.value || null },
              })
            }
            placeholder="Enter community slug or ID"
            className={INPUT_CLASS}
          />
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="identity-collaborators"
          className="block text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          Tag Co-Authors / Collaborators
        </label>
        <div className="relative">
          <input
            id="identity-collaborators"
            type="text"
            value={collabQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search creators by name or @handle..."
            className={INPUT_CLASS}
          />
          {searching && (
            <span className="text-[11px] text-slate-400 mt-1 block">Searching creators...</span>
          )}
          {collabResults.length > 0 && (
            <div className="mt-1.5 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-[#080F2E] shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
              {collabResults.map((u) => (
                <button
                  key={u.uid || u.id}
                  type="button"
                  onClick={() => addCollaborator(u)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/10 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {u.displayName || u.name || u.username}
                  </span>
                  {u.username && (
                    <span className="text-slate-500 dark:text-slate-400">@{u.username}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {collaborators.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {collaborators.map((c) => (
              <div
                key={c.uid}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-arvdoul-purple/12 text-arvdoul-purple text-xs font-semibold"
              >
                <span>{c.displayName || `@${c.username}`}</span>
                <button
                  type="button"
                  onClick={() => removeCollaborator(c.uid)}
                  aria-label={`Remove collaborator ${c.displayName}`}
                  className="p-0.5 rounded hover:bg-arvdoul-purple/20"
                >
                  <Icons.X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
