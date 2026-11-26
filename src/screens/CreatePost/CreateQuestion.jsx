// src/screens/CreatePost/CreateQuestion.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import LinkExtension from '@tiptap/extension-link';
import CharacterCount from '@tiptap/extension-character-count';
import DOMPurify from 'dompurify';
import * as Icons from 'lucide-react';
import 'tippy.js/dist/tippy.css';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { useCreatePostState, useCreatePostServices } from './CreatePostContext.jsx';
import { SURFACE_GLASS_CLASS } from './createPostConstants.js';
import {
  UserMention,
  HashtagMention,
  createCharLimitExtension,
  createMentionSuggestion,
  createHashtagSuggestion,
} from './tiptapShared.js';

const MAX_CHARS = 500;
const STATE_SYNC_DEBOUNCE = 200;

const QUESTION_HASHTAGS = [
  'arvdoul',
  'question',
  'ask',
  'community',
  'advice',
  'opinion',
  'discussion',
  'help',
  'feedback',
  'poll',
];

const CharLimitExtension = createCharLimitExtension(MAX_CHARS);

const QuestionPreview = React.memo(({ htmlContent }) => {
  const clean = useMemo(() => {
    const sanitized = DOMPurify.sanitize(htmlContent || '', {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload'],
      ALLOW_DATA_ATTR: false,
    });
    if (!sanitized) return '';
    try {
      const parsed = new DOMParser().parseFromString(sanitized, 'text/html');
      parsed.querySelectorAll('a[href]').forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
      return parsed.body.innerHTML;
    } catch (err) {
      console.warn('[CreateQuestion] Preview parse fallback:', err?.message);
      return sanitized;
    }
  }, [htmlContent]);

  return (
    <div className={`${SURFACE_GLASS_CLASS} p-5 space-y-2`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-arvdoul-purple">
        Question Preview
      </p>
      {clean ? (
        <div
          className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      ) : (
        <p className="text-sm text-slate-400 italic">Your question will appear here.</p>
      )}
    </div>
  );
});

export default function CreateQuestion() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, searchUsers, autoSaveStatus, lastSavedAt } = useCreatePostServices();
  const [previewOpen, setPreviewOpen] = useState(false);
  const syncTimerRef = useRef(null);

  const mentionSuggestion = useMemo(() => createMentionSuggestion(searchUsers, { limit: 6 }), [searchUsers]);
  const hashtagSuggestion = useMemo(() => createHashtagSuggestion(QUESTION_HASHTAGS), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bold: true,
        italic: true,
        strike: true,
        code: false,
        link: false,
        underline: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Ask a clear question to spark replies...',
        emptyEditorClass: 'is-editor-empty',
      }),
      LinkExtension.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-arvdoul-purple underline hover:opacity-80',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      UserMention.configure({
        HTMLAttributes: { class: 'text-arvdoul-purple font-semibold' },
        suggestion: mentionSuggestion,
        renderLabel({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
      }),
      HashtagMention.configure({
        char: '#',
        HTMLAttributes: { class: 'text-arvdoul-purple font-semibold' },
        suggestion: hashtagSuggestion,
        renderLabel({ node }) {
          return `#${node.attrs.label ?? node.attrs.id}`;
        },
      }),
      CharacterCount.configure({ limit: MAX_CHARS }),
      CharLimitExtension,
    ],
    content: state.contentJSON || state.content || '',
    onUpdate: ({ editor: activeEditor }) => {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        const json = activeEditor.getJSON();
        const text = activeEditor.getText();
        dispatch({ type: 'SET_CONTENT_JSON', payload: json });
        dispatch({ type: 'SET_CONTENT', payload: text });
        dispatch({ type: 'SET_CONTENT_READY', payload: text.trim().length > 0 });
      }, STATE_SYNC_DEBOUNCE);
    },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[170px] text-slate-900 dark:text-white text-[15px] leading-relaxed',
        'aria-label': 'Question text',
      },
    },
  });

  useEffect(() => {
    return () => clearTimeout(syncTimerRef.current);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const incoming = state.contentJSON || state.content || '';
    if (typeof incoming === 'object' && incoming !== null) {
      const currentJSON = JSON.stringify(editor.getJSON());
      const nextJSON = JSON.stringify(incoming);
      if (currentJSON !== nextJSON) {
        editor.commands.setContent(incoming, false);
      }
    } else if (typeof incoming === 'string' && incoming !== editor.getText()) {
      editor.commands.setContent(incoming, false);
    }
  }, [editor, state.contentJSON, state.content]);

  const charCount = editor?.storage.characterCount.characters?.() ?? (state.content?.length || 0);
  const isNearLimit = charCount >= MAX_CHARS - 25;

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Ask a Question
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Invite thoughtful answers from your audience
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-label={previewOpen ? 'Switch to question editor' : 'Preview question'}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {previewOpen ? <Icons.Edit3 className="w-3.5 h-3.5" /> : <Icons.Eye className="w-3.5 h-3.5" />}
            <span>{previewOpen ? 'Edit' : 'Preview'}</span>
          </button>

          <button
            type="button"
            onClick={saveDraft}
            disabled={autoSaveStatus === 'saving'}
            aria-label="Save draft"
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-95 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
            style={{ background: BRAND_GRADIENT }}
          >
            {autoSaveStatus === 'saving' ? (
              <LoadingSpinner size="xs" color="white" />
            ) : (
              <Icons.Save className="w-3.5 h-3.5" />
            )}
            <span>Save Draft</span>
          </button>
        </div>
      </div>

      <div className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-3`}>
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#03071B]/60 p-4 focus-within:ring-2 focus-within:ring-arvdoul-purple transition-shadow">
          <EditorContent editor={editor} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
          <span
            className={
              isNearLimit
                ? 'text-amber-600 dark:text-amber-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }
          >
            {charCount} / {MAX_CHARS} characters{isNearLimit ? ' · Approaching limit' : ''}
          </span>

          <div aria-live="polite" className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            {autoSaveStatus === 'saving' && (
              <>
                <LoadingSpinner size="xs" />
                <span>Saving draft...</span>
              </>
            )}
            {autoSaveStatus === 'saved' && lastSavedAt && (
              <>
                <Icons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <QuestionPreview htmlContent={editor?.getHTML() || ''} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}