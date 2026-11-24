// src/screens/CreatePost/tiptapShared.js
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import Mention from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import { toast } from 'sonner';

export const DEFAULT_TRENDING_HASHTAGS = [
  'arvdoul',
  'thoughts',
  'life',
  'tech',
  'design',
  'community',
  'inspiration',
  'writing',
  'story',
  'creative',
];

export const UserMention = Mention.extend({ name: 'userMention' });
export const HashtagMention = Mention.extend({ name: 'hashtagMention' });

export function createCharLimitExtension(maxChars) {
  return Extension.create({
    name: 'charLimit',
    addProseMirrorPlugins() {
      const plugin = new Plugin({
        key: new PluginKey('charLimit'),
        filterTransaction(tr, state) {
          if (!tr.docChanged) return true;
          const resultLen = (() => {
            let node = state.doc;
            tr.steps.forEach((step) => {
              try {
                node = step.apply(node).doc ?? node;
              } catch (e) {
                console.warn('[tiptapShared] Step length check fallback:', e?.message);
              }
            });
            return node?.textContent?.length ?? tr.doc.textContent.length;
          })();
          return resultLen <= maxChars;
        },
      });
      return [plugin];
    },
  });
}

function updateActiveOption(component, activeIndex, prefix) {
  if (!component) return 0;
  const options = component.querySelectorAll('[role="option"]');
  if (options.length === 0) return 0;
  const clamped = Math.max(0, Math.min(activeIndex, options.length - 1));
  options.forEach((opt, i) => {
    if (i === clamped) {
      opt.setAttribute('aria-selected', 'true');
      opt.classList.add('bg-arvdoul-purple/15', 'text-arvdoul-purple');
    } else {
      opt.removeAttribute('aria-selected');
      opt.classList.remove('bg-arvdoul-purple/15', 'text-arvdoul-purple');
    }
  });
  component.setAttribute('aria-activedescendant', `${prefix}-${clamped}`);
  return clamped;
}

export function createMentionSuggestion(searchUsers, { debounceMs = 300, limit = 7 } = {}) {
  let debounceTimer = null;
  let abortController = null;
  let activeIndex = 0;

  return {
    items: async ({ query }) => {
      abortController?.abort();
      abortController = new AbortController();
      const currentController = abortController;
      clearTimeout(debounceTimer);
      return new Promise((resolve) => {
        debounceTimer = setTimeout(async () => {
          try {
            const users = await searchUsers(query);
            if (!currentController.signal.aborted) {
              resolve(
                (Array.isArray(users) ? users : []).slice(0, limit).map((u) => ({
                  id: u.id,
                  label: u.username || u.displayName || 'member',
                  avatar: u.photoURL || '',
                }))
              );
            }
          } catch (err) {
            if (!currentController.signal.aborted) {
              toast.error('User search failed');
              console.warn('[tiptapShared] Mention lookup failed:', err?.message);
              resolve([]);
            }
          }
        }, debounceMs);
      });
    },
    render: () => {
      let component = null;
      let popup = null;
      let isVisible = false;

      return {
        onStart: (props) => {
          component = document.createElement('div');
          component.setAttribute('role', 'listbox');
          component.className =
            'mention-dropdown bg-white dark:bg-[#080F2E] border border-slate-200 dark:border-white/12 rounded-xl shadow-xl p-1.5 min-w-[220px]';
          const instances = tippy(document.body, {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            onShow: () => {
              isVisible = true;
            },
            onHide: () => {
              isVisible = false;
              activeIndex = 0;
            },
          });
          popup = instances?.[0] ?? null;
          popup?.show?.();
        },
        onUpdate: (props) => {
          if (!component) return;
          component.replaceChildren();
          activeIndex = 0;
          if (!props.items || props.items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'px-3 py-2 text-xs text-slate-500 dark:text-slate-400';
            empty.textContent = 'No users found';
            component.appendChild(empty);
          } else {
            props.items.forEach((item, idx) => {
              const row = document.createElement('button');
              row.type = 'button';
              row.setAttribute('role', 'option');
              row.id = `mention-option-${idx}`;
              row.className =
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-900 dark:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors';

              const safeLabel = String(item.label || 'member');
              const validAvatar =
                typeof item.avatar === 'string' && /^https?:\/\//.test(item.avatar);
              if (validAvatar) {
                const avatarEl = document.createElement('img');
                avatarEl.src = item.avatar;
                avatarEl.className = 'w-6 h-6 rounded-full object-cover shrink-0';
                avatarEl.alt = '';
                avatarEl.onerror = () => avatarEl.remove();
                row.appendChild(avatarEl);
              } else {
                const fallback = document.createElement('div');
                fallback.className =
                  'w-6 h-6 rounded-full bg-arvdoul-purple/20 flex items-center justify-center text-xs font-bold text-arvdoul-purple shrink-0';
                fallback.textContent = (safeLabel[0] || 'U').toUpperCase();
                row.appendChild(fallback);
              }

              const labelSpan = document.createElement('span');
              labelSpan.className = 'truncate';
              labelSpan.textContent = `@${safeLabel}`;
              row.appendChild(labelSpan);

              row.addEventListener('click', () => {
                props.command({ id: item.id, label: safeLabel });
                popup?.hide?.();
              });
              component.appendChild(row);
            });
            activeIndex = updateActiveOption(component, 0, 'mention-option');
          }
          popup?.setProps?.({ getReferenceClientRect: props.clientRect });
        },
        onKeyDown: (props) => {
          if (!isVisible || !component) return false;
          if (props.event.key === 'Escape') {
            popup?.hide?.();
            return true;
          }
          if (props.event.key === 'ArrowDown') {
            activeIndex = updateActiveOption(component, activeIndex + 1, 'mention-option');
            return true;
          }
          if (props.event.key === 'ArrowUp') {
            activeIndex = updateActiveOption(component, activeIndex - 1, 'mention-option');
            return true;
          }
          if (props.event.key === 'Enter' || props.event.key === 'Tab') {
            const items = component.querySelectorAll('[role="option"]');
            if (items[activeIndex]) items[activeIndex].click();
            return true;
          }
          return false;
        },
        onExit: () => {
          clearTimeout(debounceTimer);
          abortController?.abort();
          popup?.destroy?.();
          popup = null;
        },
      };
    },
  };
}

export function createHashtagSuggestion(
  tags = DEFAULT_TRENDING_HASHTAGS,
  { debounceMs = 200 } = {}
) {
  let debounceTimer = null;
  let activeIndex = 0;

  return {
    items: async ({ query }) => {
      clearTimeout(debounceTimer);
      const q = String(query || '').toLowerCase();
      return new Promise((resolve) => {
        debounceTimer = setTimeout(() => {
          resolve(
            tags
              .filter((t) => t.toLowerCase().startsWith(q))
              .map((t) => ({ id: t, label: t }))
          );
        }, debounceMs);
      });
    },
    render: () => {
      let component = null;
      let popup = null;
      let isVisible = false;

      return {
        onStart: (props) => {
          component = document.createElement('div');
          component.setAttribute('role', 'listbox');
          component.className =
            'hashtag-dropdown bg-white dark:bg-[#080F2E] border border-slate-200 dark:border-white/12 rounded-xl shadow-xl p-1.5 min-w-[180px]';
          const instances = tippy(document.body, {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            onShow: () => {
              isVisible = true;
            },
            onHide: () => {
              isVisible = false;
              activeIndex = 0;
            },
          });
          popup = instances?.[0] ?? null;
          popup?.show?.();
        },
        onUpdate: (props) => {
          if (!component) return;
          component.replaceChildren();
          activeIndex = 0;
          if (!props.items || props.items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'px-3 py-2 text-xs text-slate-500 dark:text-slate-400';
            empty.textContent = 'No matching hashtags';
            component.appendChild(empty);
          } else {
            props.items.forEach((item, idx) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.setAttribute('role', 'option');
              btn.id = `hashtag-option-${idx}`;
              btn.className =
                'w-full text-left px-3 py-2 text-sm text-slate-900 dark:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors';
              btn.textContent = `#${item.label}`;
              btn.addEventListener('click', () => {
                props.command({ id: item.id, label: item.label });
                popup?.hide?.();
              });
              component.appendChild(btn);
            });
            activeIndex = updateActiveOption(component, 0, 'hashtag-option');
          }
          popup?.setProps?.({ getReferenceClientRect: props.clientRect });
        },
        onKeyDown: (props) => {
          if (!isVisible || !component) return false;
          if (props.event.key === 'Escape') {
            popup?.hide?.();
            return true;
          }
          if (props.event.key === 'ArrowDown') {
            activeIndex = updateActiveOption(component, activeIndex + 1, 'hashtag-option');
            return true;
          }
          if (props.event.key === 'ArrowUp') {
            activeIndex = updateActiveOption(component, activeIndex - 1, 'hashtag-option');
            return true;
          }
          if (props.event.key === 'Enter' || props.event.key === 'Tab') {
            const items = component.querySelectorAll('[role="option"]');
            if (items[activeIndex]) items[activeIndex].click();
            return true;
          }
          return false;
        },
        onExit: () => {
          clearTimeout(debounceTimer);
          popup?.destroy?.();
          popup = null;
        },
      };
    },
  };
}
