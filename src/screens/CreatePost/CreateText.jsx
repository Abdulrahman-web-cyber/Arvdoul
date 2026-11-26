// src/screens/CreatePost/CreateText.jsx
import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
import { SURFACE_GLASS_CLASS, INPUT_CLASS } from './createPostConstants.js';
import {
  UserMention,
  HashtagMention,
  createCharLimitExtension,
  createMentionSuggestion,
  createHashtagSuggestion,
} from './tiptapShared.js';
import { Modal } from './ComposerPanels.jsx';

const MAX_CHARS = 5000;
const STATE_SYNC_DEBOUNCE = 220;

const CharLimitExtension = createCharLimitExtension(MAX_CHARS);

function speakGlobal(text, onEnd, opts = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = opts.rate || 1;
  utterance.onend = onEnd;
  utterance.onerror = (e) => {
    if (e.error !== 'canceled') toast.error('Speech playback failed');
    onEnd();
  };
  window.speechSynthesis.speak(utterance);
}

function cancelGlobalSpeech() {
  if (typeof window !== 'undefined') {
    window.speechSynthesis?.cancel();
  }
}

const LocalPostPreview = React.memo(({ htmlContent }) => {
  const sanitised = useMemo(() => {
    const clean = DOMPurify.sanitize(htmlContent || '', {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's',
        'blockquote', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload'],
      ALLOW_DATA_ATTR: false,
    });
    if (!clean) return '';
    try {
      const parsed = new DOMParser().parseFromString(clean, 'text/html');
      parsed.querySelectorAll('a[href]').forEach((a) => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
      return parsed.body.innerHTML;
    } catch (err) {
      console.warn('[CreateText] Preview parse fallback:', err?.message);
      return clean;
    }
  }, [htmlContent]);

  return (
    <div className={`${SURFACE_GLASS_CLASS} p-5`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
        Formatted Preview
      </p>
      {sanitised ? (
        <div
          className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitised }}
        />
      ) : (
        <p className="text-sm text-slate-400 italic">Your formatted post preview will appear here.</p>
      )}
    </div>
  );
});

export default function CreateText() {
  const { state, dispatch } = useCreatePostState();
  const { saveDraft, searchUsers, autoSaveStatus, lastSavedAt } = useCreatePostServices();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const ttsTimerRef = useRef(null);
  const syncTimerRef = useRef(null);

  const mentionSuggestion = useMemo(() => createMentionSuggestion(searchUsers), [searchUsers]);
  const hashtagSuggestion = useMemo(() => createHashtagSuggestion(), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Write your thoughts... (type @ to mention or # for hashtags)',
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
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[220px] text-slate-900 dark:text-white text-[15px] leading-relaxed',
        'aria-label': 'Post content editor',
      },
    },
  });

  // Hydrate editor when draft or edit payload updates externally
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

  useEffect(() => {
    if (!editor) return;
    const updateState = () => {
      const json = editor.getJSON();
      const text = editor.getText();
      dispatch({ type: 'SET_CONTENT_JSON', payload: json });
      dispatch({ type: 'SET_CONTENT', payload: text });
      dispatch({ type: 'SET_CONTENT_READY', payload: text.trim().length > 0 });
    };

    const handler = () => {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(updateState, STATE_SYNC_DEBOUNCE);
    };

    editor.on('update', handler);
    return () => {
      clearTimeout(syncTimerRef.current);
      editor.off('update', handler);
    };
  }, [editor, dispatch]);

  const insertLink = useCallback(() => {
    if (!linkUrl || !editor) return;
    try {
      const url = new URL(linkUrl.trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
      editor.chain().focus().setLink({ href: url.toString() }).run();
      setShowLinkModal(false);
      setLinkUrl('');
    } catch {
      toast.error('Please enter a valid http or https URL');
    }
  }, [editor, linkUrl]);

  const startSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error('Speech playback is not supported in this browser');
      return;
    }
    if (isSpeaking) {
      cancelGlobalSpeech();
      setIsSpeaking(false);
      setTtsLoading(false);
      clearTimeout(ttsTimerRef.current);
      return;
    }
    const text = editor?.getText() || state.content || '';
    if (!text.trim()) {
      toast.info('Write some text first to listen');
      return;
    }
    setTtsLoading(true);
    setIsSpeaking(true);
    speakGlobal(
      text,
      () => {
        setIsSpeaking(false);
        setTtsLoading(false);
        clearTimeout(ttsTimerRef.current);
      },
      { rate: 1 }
    );
    ttsTimerRef.current = setTimeout(() => {
      cancelGlobalSpeech();
      setIsSpeaking(false);
      setTtsLoading(false);
    }, Math.min(text.length * 65, 60000));
  }, [editor, state.content, isSpeaking]);

  useEffect(() => {
    return () => {
      cancelGlobalSpeech();
      clearTimeout(ttsTimerRef.current);
    };
  }, []);

  const readingTime = useMemo(() => {
    const words = (state.content || '').split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.ceil(words / 200))} min read`;
  }, [state.content]);

  const formattingButtons = useMemo(
    () => [
      {
        icon: Icons.Bold,
        action: () => editor?.chain().focus().toggleBold().run(),
        isActive: () => editor?.isActive('bold'),
        label: 'Bold',
      },
      {
        icon: Icons.Italic,
        action: () => editor?.chain().focus().toggleItalic().run(),
        isActive: () => editor?.isActive('italic'),
        label: 'Italic',
      },
      {
        icon: Icons.Underline,
        action: () => editor?.chain().focus().toggleUnderline().run(),
        isActive: () => editor?.isActive('underline'),
        label: 'Underline',
      },
      {
        icon: Icons.Strikethrough,
        action: () => editor?.chain().focus().toggleStrike().run(),
        isActive: () => editor?.isActive('strike'),
        label: 'Strikethrough',
      },
      {
        icon: Icons.Link2,
        action: () => setShowLinkModal(true),
        isActive: () => editor?.isActive('link'),
        label: 'Insert link',
      },
      {
        icon: Icons.List,
        action: () => editor?.chain().focus().toggleBulletList().run(),
        isActive: () => editor?.isActive('bulletList'),
        label: 'Bullet list',
      },
      {
        icon: Icons.ListOrdered,
        action: () => editor?.chain().focus().toggleOrderedList().run(),
        isActive: () => editor?.isActive('orderedList'),
        label: 'Numbered list',
      },
      {
        icon: Icons.Heading1,
        action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor?.isActive('heading', { level: 1 }),
        label: 'Heading 1',
      },
      {
        icon: Icons.Heading2,
        action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor?.isActive('heading', { level: 2 }),
        label: 'Heading 2',
      },
      {
        icon: Icons.Quote,
        action: () => editor?.chain().focus().toggleBlockquote().run(),
        isActive: () => editor?.isActive('blockquote'),
        label: 'Blockquote',
      },
      {
        icon: Icons.Undo2,
        action: () => editor?.chain().focus().undo().run(),
        isActive: () => false,
        disabled: !editor?.can().undo(),
        label: 'Undo text change',
      },
      {
        icon: Icons.Redo2,
        action: () => editor?.chain().focus().redo().run(),
        isActive: () => false,
        disabled: !editor?.can().redo(),
        label: 'Redo text change',
      },
    ],
    [editor]
  );

  const charCount = editor?.storage.characterCount.characters?.() ?? (state.content?.length || 0);
  const wordCount = editor?.storage.characterCount.words?.() ?? 0;

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-4">
      {/* Studio Subheader & Utility Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Write Post
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rich formatting, @mentions, and #hashtags
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startSpeaking}
            disabled={typeof window === 'undefined' || !window.speechSynthesis}
            aria-label={isSpeaking ? 'Stop speech playback' : 'Listen to post text'}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-[#080F2E]/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-45 whitespace-nowrap"
          >
            {ttsLoading ? (
              <LoadingSpinner size="xs" />
            ) : isSpeaking ? (
              <Icons.VolumeX className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Icons.Volume2 className="w-3.5 h-3.5 text-arvdoul-purple" />
            )}
            <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-label={previewOpen ? 'Switch to edit view' : 'Preview formatted post'}
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

      {/* Main Editor Glass Surface */}
      <div className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-3`}>
        {/* Formatting Toolbar */}
        <div
          className="flex flex-wrap items-center gap-1 pb-3 border-b border-slate-200/70 dark:border-white/10"
          role="toolbar"
          aria-label="Text formatting"
        >
          {formattingButtons.map((btn, idx) => {
            const disabled = btn.disabled === true;
            const active = btn.isActive();
            return (
              <button
                key={idx}
                type="button"
                onClick={disabled ? undefined : btn.action}
                disabled={disabled}
                title={btn.label}
                aria-label={btn.label}
                aria-pressed={!!active}
                className={`min-h-[38px] min-w-[38px] p-2 rounded-xl transition-all flex items-center justify-center ${
                  active
                    ? 'bg-arvdoul-purple text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <btn.icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {previewOpen ? (
          <LocalPostPreview htmlContent={editor?.getHTML() || ''} />
        ) : (
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-[#03071B]/60 p-4 focus-within:ring-2 focus-within:ring-arvdoul-purple transition-shadow">
            <EditorContent editor={editor} />
          </div>
        )}

        {/* Metrics & Sync Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          <div className="flex items-center gap-3">
            <span>
              {charCount} / {MAX_CHARS} chars
            </span>
            <span>{wordCount} words</span>
            <span>{readingTime}</span>
          </div>
          <div aria-live="polite" className="flex items-center gap-1.5">
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

      {/* Link Modal */}
      <AnimatePresence>
        {showLinkModal && (
          <Modal onClose={() => setShowLinkModal(false)} labelledBy="insert-link-modal-title">
            <h3 id="insert-link-modal-title" className="text-lg font-bold mb-1.5">
              Insert Link
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter a full http or https web address to link the selected text.
            </p>
            <input
              aria-label="Link URL"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className={INPUT_CLASS}
              autoFocus
            />
            <div className="flex gap-2.5 mt-4">
              <button
                type="button"
                onClick={insertLink}
                className="min-h-[44px] flex-1 py-2.5 rounded-xl text-white font-semibold text-sm"
                style={{ background: BRAND_GRADIENT }}
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="min-h-[44px] flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}