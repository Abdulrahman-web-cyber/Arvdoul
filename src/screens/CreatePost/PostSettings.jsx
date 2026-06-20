// src/screens/CreatePost/PostSettings.jsx
import React, { useState } from "react";
import * as Icons from "lucide-react";
import CreatableSelect from "react-select/creatable";

const UltraToggle = ({ enabled, onChange, label, description }) => (
  <div className="flex items-center justify-between py-3">
    <div><p className="font-medium text-sm">{label}</p>{description && <p className="text-xs text-gray-500">{description}</p>}</div>
    <button onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 ${enabled ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"}`}
      role="switch" aria-checked={enabled} aria-label={label}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  </div>
);

export default function PostSettings({
  state, dispatch, isDark, user, userCoins, services,
  VISIBILITY_OPTIONS, MONETIZATION_TYPES, BOOST_TIERS, CARD,
  mentionOptions, selectedCoAuthors, handleCoAuthorChange
}) {
  return (
    <div className="space-y-8">
      <div className={`${CARD} p-4`}>
        <h3 className="text-lg font-bold mb-3">Visibility</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {VISIBILITY_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => dispatch({ type: "SET_VISIBILITY", payload: opt.id })}
              className={`p-3 rounded-xl border-2 text-center transition-all ${state.visibility === opt.id ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md" : "border-gray-200 dark:border-gray-700 hover:shadow-md"}`}>
              <opt.icon className={`w-5 h-5 mx-auto mb-1 ${opt.color}`} />
              <p className="text-xs font-bold">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className={`${CARD} p-4`}>
        <h3 className="text-lg font-bold mb-3">Collaborators</h3>
        <CreatableSelect isMulti options={mentionOptions} value={selectedCoAuthors} onChange={handleCoAuthorChange}
          placeholder="Tag co-authors..." styles={{ control: (base) => ({ ...base, background: "transparent", borderColor: "transparent" }) }} />
      </div>

      <div className={`${CARD} p-4`}>
        <h3 className="text-lg font-bold mb-3">Monetization</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MONETIZATION_TYPES.map(opt => (
            <button key={opt.id} onClick={() => dispatch({ type: "SET_MONETIZATION", payload: opt.id })}
              className={`p-3 rounded-xl border-2 text-center transition-all ${state.monetization === opt.id ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md" : "border-gray-200 dark:border-gray-700 hover:shadow-md"}`}>
              <opt.icon className={`w-5 h-5 mx-auto mb-1 ${opt.color}`} />
              <p className="text-xs font-bold">{opt.label}</p>
              {opt.fee > 0 && <p className="text-xs text-red-500">{opt.fee}%</p>}
            </button>
          ))}
        </div>
      </div>

      <div className={`${CARD} p-4`}>
        <h3 className="text-lg font-bold mb-3">Boost Post</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BOOST_TIERS.map(opt => (
            <div key={opt.id} className={`relative p-3 rounded-xl border-2 text-center transition-all ${state.boost === opt.id ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md" : "border-gray-200 dark:border-gray-700 hover:shadow-md"}`}>
              {opt.recommended && <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-green-500 text-white text-xs">★</span>}
              <opt.icon className={`w-6 h-6 mx-auto mb-1 text-purple-500`} />
              <p className="font-bold text-xs">{opt.label}</p>
              <p className="text-amber-500 text-xs">{opt.coins} 🪙</p>
              <button onClick={() => userCoins >= opt.coins && dispatch({ type: "SET_BOOST", payload: opt.id })} disabled={opt.coins > 0 && userCoins < opt.coins}
                className="mt-2 w-full py-1 text-xs rounded-full bg-purple-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed">Select</button>
            </div>
          ))}
        </div>
      </div>

      <div className={`${CARD} p-4`}>
        <h3 className="text-lg font-bold mb-3">Schedule & Expiry</h3>
        <input type="datetime-local" value={state.scheduledTime ? new Date(state.scheduledTime).toISOString().slice(0,16) : ''} onChange={e => dispatch({ type: "SET_SCHEDULED_TIME", payload: e.target.value ? new Date(e.target.value).toISOString() : null })}
          className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700 mb-2" placeholder="Schedule (optional)" />
        <input type="datetime-local" value={state.expiresAt ? new Date(state.expiresAt).toISOString().slice(0,16) : ''} onChange={e => dispatch({ type: "SET_EXPIRES_AT", payload: e.target.value ? new Date(e.target.value).toISOString() : null })}
          className="w-full p-2 rounded border dark:bg-gray-900 dark:border-gray-700" placeholder="Expires (optional)" />
      </div>

      <div className={`${CARD} p-4`}>
        <h3 className="text-lg font-bold mb-3">Advanced</h3>
        <UltraToggle enabled={state.settings.enableComments} onChange={v => dispatch({ type: "UPDATE_SETTINGS", payload: { enableComments: v } })} label="Enable Comments" />
        <UltraToggle enabled={state.settings.enableGifts} onChange={v => dispatch({ type: "UPDATE_SETTINGS", payload: { enableGifts: v } })} label="Allow Gifts" />
        <UltraToggle enabled={state.settings.enableSharing} onChange={v => dispatch({ type: "UPDATE_SETTINGS", payload: { enableSharing: v } })} label="Allow Sharing" />
        <UltraToggle enabled={state.settings.isNSFW} onChange={v => dispatch({ type: "UPDATE_SETTINGS", payload: { isNSFW: v } })} label="NSFW" />
        <UltraToggle enabled={state.settings.addToStory} onChange={v => dispatch({ type: "UPDATE_SETTINGS", payload: { addToStory: v } })} label="Add to Story" description="Also share as 24h story" />
      </div>
    </div>
  );
}