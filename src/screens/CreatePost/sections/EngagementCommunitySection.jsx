// src/screens/CreatePost/sections/EngagementCommunitySection.jsx
import { useCreatePostState } from '../CreatePostContext.jsx';
import { COMMENT_MODES, SURFACE_GLASS_CLASS } from '../createPostConstants.js';

export default function EngagementCommunitySection() {
  const { state, dispatch } = useCreatePostState();
  const eng = state.engagementControls || {};

  const setCommentMode = (mode) => {
    dispatch({
      type: 'SET_ENGAGEMENT_CONTROLS',
      payload: {
        commentMode: mode,
        enableComments: mode !== 'off',
      },
    });
  };

  const toggleControl = (key) => {
    dispatch({
      type: 'SET_ENGAGEMENT_CONTROLS',
      payload: { [key]: eng[key] === false ? true : !eng[key] },
    });
  };

  return (
    <section
      id="composer-section-engagement"
      aria-labelledby="heading-engagement"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
          04
        </span>
        <div>
          <h3 id="heading-engagement" className="text-sm font-semibold text-slate-900 dark:text-white">
            Engagement &amp; Community Controls
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comment permissions, reactions, virtual gifts, saves, and shares
          </p>
        </div>
      </div>

      <div>
        <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
          Comment access
        </span>
        <div className="grid grid-cols-3 gap-2">
          {COMMENT_MODES.map((m) => {
            const active = (eng.commentMode || 'everyone') === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setCommentMode(m.id)}
                className={`min-h-[40px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-arvdoul-purple text-white border-arvdoul-purple'
                    : 'bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[
          { key: 'enableReactions', label: 'Enable reactions & likes' },
          { key: 'enableGifts', label: 'Allow virtual gifts on post' },
          { key: 'enableSaves', label: 'Allow bookmarking & saves' },
          { key: 'enableShares', label: 'Allow external & DM sharing' },
        ].map((item) => (
          <label
            key={item.key}
            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] cursor-pointer"
          >
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {item.label}
            </span>
            <input
              type="checkbox"
              checked={eng[item.key] !== false}
              onChange={() => toggleControl(item.key)}
              className="w-4 h-4 accent-arvdoul-purple rounded"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
