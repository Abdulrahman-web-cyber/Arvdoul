// src/screens/CreatePost/ImageEditor.jsx
//
// Arvdoul Image Studio
// ─────────────────────────────────────────────────────────────────────────────
// Architecture
//   • documentReducer     – single source of truth (image, adjustments, filter,
//                           layers) with labelled, coalescing undo/redo history.
//   • renderProcessed()   – one pure, single-pass pixel pipeline used by BOTH the
//                           live preview and the full-resolution export.
//   • shapeGeometry() /   – one description of every layer type, shared by the
//     *Attrs() builders     react-konva preview and the Konva export renderer, so
//                           what you see is exactly what you export.
//   • Shared tools        – AdjustTool, FilterTool, CropTool, TextTool and
//                           DrawingTool are used with the exact prop contracts
//                           they had before.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
  forwardRef,
  memo,
} from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Text as KonvaText,
  Transformer,
  Rect,
  Line,
  Group,
  Circle,
  Ellipse,
  Star,
  RegularPolygon,
} from 'react-konva';
import Cropper from 'react-easy-crop';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import Konva from 'konva';
import { v4 as uuidv4 } from 'uuid';
// NOTE: browser-image-compression is loaded on demand inside imageEffects.js
// (compressImage). A static import here would also pull it into the initial
// ImageEditor chunk, defeating that lazy load (audit build warning).
import FocusTrap from 'focus-trap-react';
import clamp from 'lodash-es/clamp';
import useMediaQuery from '../../hooks/useMediaQuery';
import { cn } from '../../lib/utils';
import { loadImage, createCanvas, cleanupImage } from './imageEffects';
import AdjustTool from '../../components/Shared/AdjustTool';
import FilterTool from '../../components/Shared/FilterTool';
import CropTool from '../../components/Shared/CropTool';
import TextTool from '../../components/Shared/TextTool';
import DrawingTool from '../../components/Shared/DrawingTool';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { useTheme } from '../../context/ThemeContext';

/* ────────────────────────────────────────────────────────────────────────────
 * Icons (resolved defensively so a lucide-react rename can never crash render)
 * ──────────────────────────────────────────────────────────────────────────── */

const pick = (...names) => {
  for (const n of names) if (Icons[n]) return Icons[n];
  return Icons.Circle || (() => null);
};
const IClose = pick('X');
const IUndo = pick('Undo2', 'Undo');
const IRedo = pick('Redo2', 'Redo');
const IDownload = pick('Download');
const ICheck = pick('Check');
const ICrop = pick('Crop');
const ISliders = pick('SlidersHorizontal', 'Sliders');
const IWand = pick('Wand2', 'WandSparkles', 'Sparkles');
const IType = pick('Type');
const IPencil = pick('Pencil', 'PenTool');
const IShapes = pick('Shapes', 'Square');
const ISmile = pick('Smile');
const IImagePlus = pick('ImagePlus', 'Image');
const ILayers = pick('Layers');
const IHistory = pick('History');
const IPointer = pick('MousePointer2', 'MousePointer');
const IHand = pick('Hand');
const IGrid = pick('Grid3x3', 'Grid3X3', 'Grid');
const IEye = pick('Eye');
const IEyeOff = pick('EyeOff');
const ILock = pick('Lock');
const IUnlock = pick('Unlock', 'LockOpen');
const ICopy = pick('Copy');
const ITrash = pick('Trash2', 'Trash');
const IUp = pick('ArrowUp', 'ChevronUp');
const IDown = pick('ArrowDown', 'ChevronDown');
const IRotCCW = pick('RotateCcw');
const IRotCW = pick('RotateCw');
const IMinus = pick('Minus');
const IPlus = pick('Plus');
const IMaximize = pick('Maximize2', 'Maximize');
const ISparkles = pick('Sparkles');
const ICompare = pick('SplitSquareHorizontal', 'SquareSplitHorizontal', 'Columns2', 'Columns', 'Eye');
const ISun = pick('Sun');
const IMoon = pick('Moon');
const IAlert = pick('AlertCircle', 'CircleAlert');
const IProps = pick('SlidersVertical', 'Settings2', 'Settings');
const IAlignL = pick('AlignLeft');
const IAlignC = pick('AlignCenter');
const IAlignR = pick('AlignRight');
const IFrame = pick('Scan', 'Square');

/* ────────────────────────────────────────────────────────────────────────────
 * Design tokens (shared with the Signup / Login / OTP / Verify / Setup screens)
 * ──────────────────────────────────────────────────────────────────────────── */

const GRADIENT = 'linear-gradient(125deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)';
const ACCENT = '#7A6BFF';

const THEMES = {
  dark: {
    colorScheme: 'dark',
    '--bg': '#03071B',
    '--text': '#F3F5FF',
    '--text-2': '#B4BEDF',
    '--text-3': '#8490B8',
    '--accent-text': '#B8AAFF',
    '--card-border': 'rgba(174,185,255,0.20)',
    '--card-shadow': '0 24px 60px -24px rgba(0,0,0,0.72), 0 10px 28px -18px rgba(65,49,247,0.32)',
    '--field-bg': 'rgba(13,22,59,0.34)',
    '--field-bg-focus': 'rgba(20,29,78,0.55)',
    '--field-bg-solid': '#0A1030',
    '--field-border': 'rgba(162,176,255,0.22)',
    '--field-border-hover': 'rgba(174,169,255,0.48)',
    '--field-focus': '#9B8BFF',
    '--field-ring': 'rgba(117,99,255,0.23)',
    '--danger': '#FF879B',
    '--danger-ring': 'rgba(255,90,120,0.18)',
    '--success': '#49E3AC',
    '--warn': '#FFC46B',
    '--pop-bg': 'rgba(7,12,38,0.96)',
    '--pop-shadow': '0 24px 60px -12px rgba(0,0,0,0.72)',
    '--pop-active': 'rgba(124,108,255,0.17)',
    '--pop-selected': 'rgba(124,108,255,0.28)',
    '--line': 'rgba(165,178,255,0.20)',
    '--dot': 'rgba(165,178,255,0.10)',
    '--glow-a': 'rgba(139,30,243,0.16)',
    '--glow-b': 'rgba(5,91,251,0.13)',
    '--btn-shadow': '0 12px 28px -12px rgba(68,49,247,0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
    '--focus-outline': '#A99BFF',
    '--ie-canvas': '#050A22',
  },
  light: {
    colorScheme: 'light',
    '--bg': '#F6F8FC',
    '--text': '#101735',
    '--text-2': '#4D587B',
    '--text-3': '#7783A5',
    '--accent-text': '#4431F7',
    '--card-border': 'rgba(80,91,177,0.18)',
    '--card-shadow': '0 24px 56px -26px rgba(48,56,140,0.27), 0 10px 26px -18px rgba(68,49,247,0.20)',
    '--field-bg': 'rgba(255,255,255,0.55)',
    '--field-bg-focus': 'rgba(255,255,255,0.85)',
    '--field-bg-solid': '#FFFFFF',
    '--field-border': 'rgba(61,76,147,0.18)',
    '--field-border-hover': 'rgba(68,49,247,0.38)',
    '--field-focus': '#4431F7',
    '--field-ring': 'rgba(68,49,247,0.15)',
    '--danger': '#D42A49',
    '--danger-ring': 'rgba(212,42,73,0.13)',
    '--success': '#0E9468',
    '--warn': '#B45309',
    '--pop-bg': 'rgba(250,251,255,0.97)',
    '--pop-shadow': '0 24px 56px -14px rgba(40,50,130,0.30)',
    '--pop-active': 'rgba(68,49,247,0.075)',
    '--pop-selected': 'rgba(68,49,247,0.13)',
    '--line': 'rgba(61,76,147,0.16)',
    '--dot': 'rgba(68,49,247,0.09)',
    '--glow-a': 'rgba(139,30,243,0.07)',
    '--glow-b': 'rgba(5,91,251,0.07)',
    '--btn-shadow': '0 12px 26px -12px rgba(68,49,247,0.36), inset 0 1px 0 rgba(255,255,255,0.28)',
    '--focus-outline': '#4431F7',
    '--ie-canvas': '#E6ECF7',
  },
};

const STYLES = `
.ie-root{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;height:100vh;height:100dvh;background:var(--bg);color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;
  overscroll-behavior:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.ie-root *,.ie-root *::before,.ie-root *::after{box-sizing:border-box}
.ie-root button{font:inherit;color:inherit}
.ie-fx{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.ie-fx i{position:absolute;border-radius:50%}
.ie-fx i:nth-child(1){width:70vmax;height:70vmax;top:-40vmax;left:-30vmax;background:radial-gradient(circle,var(--glow-a),transparent 65%)}
.ie-fx i:nth-child(2){width:70vmax;height:70vmax;right:-38vmax;bottom:-42vmax;background:radial-gradient(circle,var(--glow-b),transparent 66%)}
.ie-center{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}
.ie-center h3{margin:0;font-size:17px;font-weight:800;letter-spacing:-.02em}
.ie-center p{margin:0;max-width:300px;color:var(--text-2);font-size:13px;line-height:1.55}
.ie-center .ie-row{justify-content:center}
.ie-errmark{display:grid;place-items:center;width:52px;height:52px;border-radius:18px;background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger)}

/* Top bar */
.ie-top{position:relative;z-index:5;flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:56px;
  padding:max(8px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 8px max(10px,env(safe-area-inset-left));
  border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 86%,transparent);
  -webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%)}
.ie-top-group{display:flex;align-items:center;gap:6px;min-width:0}
.ie-titlewrap{display:flex;flex-direction:column;min-width:0;line-height:1.2}
.ie-title{font-size:14px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}
.ie-sub{color:var(--text-3);font-size:11px;font-weight:650;white-space:nowrap;font-variant-numeric:tabular-nums}
.ie-iconbtn{display:grid;place-items:center;flex:none;width:40px;height:40px;border:1px solid var(--field-border);border-radius:12px;
  background:var(--field-bg);color:var(--text-2);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .18s,border-color .18s,color .18s,transform .15s}
.ie-iconbtn:hover:not(:disabled){border-color:var(--field-border-hover);color:var(--text);background:var(--field-bg-focus)}
.ie-iconbtn:active:not(:disabled){transform:scale(.95)}
.ie-iconbtn:disabled{opacity:.4;cursor:not-allowed}
.ie-iconbtn[data-active="true"]{background:${GRADIENT};border-color:transparent;color:#fff;box-shadow:var(--btn-shadow)}
.ie-iconbtn[data-danger="true"]:hover:not(:disabled){color:var(--danger);border-color:var(--danger)}
.ie-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;min-height:40px;padding:0 16px;border:1px solid rgba(255,255,255,.18);border-radius:13px;
  background:${GRADIENT};color:#fff;box-shadow:var(--btn-shadow);font-size:13.5px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:filter .2s,transform .15s}
.ie-btn:hover:not(:disabled){filter:brightness(1.08)}
.ie-btn:active:not(:disabled){transform:scale(.97)}
.ie-btn:disabled{opacity:.55;cursor:not-allowed}
.ie-btn-sec{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;min-height:40px;padding:0 14px;border:1px solid var(--field-border);border-radius:13px;
  background:var(--field-bg);color:var(--text);font-size:13px;font-weight:750;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .18s,border-color .18s}
.ie-btn-sec:hover:not(:disabled){border-color:var(--field-border-hover);background:var(--field-bg-focus)}
.ie-btn-sec:disabled{opacity:.5;cursor:not-allowed}
.ie-btn-danger{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 16px;border:1px solid color-mix(in srgb,var(--danger) 45%,transparent);
  border-radius:13px;background:color-mix(in srgb,var(--danger) 12%,transparent);color:var(--danger);font-size:13px;font-weight:800;cursor:pointer}
.ie-hist{display:block;width:76px;height:32px;border:1px solid var(--field-border);border-radius:10px;background:var(--field-bg-solid)}
@media(pointer:coarse){.ie-iconbtn{width:44px;height:44px}.ie-btn,.ie-btn-sec,.ie-btn-danger{min-height:44px}}
@media(max-width:719px){.ie-hide-md{display:none!important}}
@media(max-width:519px){.ie-hide-sm{display:none!important}.ie-btn,.ie-btn-sec{padding:0 12px}}

/* Layout */
.ie-main{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column}
.ie-ws{order:1;position:relative;flex:1;min-width:0;min-height:0;overflow:hidden;touch-action:none;background:var(--ie-canvas)}
.ie-ws::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(var(--dot) .9px,transparent 1.2px);background-size:24px 24px}
.ie-ws[data-cursor="grab"]{cursor:grab}
.ie-ws[data-cursor="grabbing"]{cursor:grabbing}
.ie-ws[data-cursor="draw"]{cursor:crosshair}
.ie-ws[data-cursor="text"]{cursor:text}
.ie-stagewrap{position:absolute;inset:0}
.ie-float{position:absolute;z-index:6;display:flex;align-items:center;gap:4px;padding:4px;border:1px solid var(--card-border);border-radius:16px;
  background:color-mix(in srgb,var(--bg) 78%,transparent);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);box-shadow:var(--card-shadow)}
.ie-float .ie-iconbtn{width:36px;height:36px;border-radius:11px;border-color:transparent;background:transparent}
.ie-float .ie-iconbtn:hover:not(:disabled){background:var(--pop-active)}
.ie-float .ie-iconbtn[data-active="true"]{background:${GRADIENT}}
.ie-view{top:10px;right:10px}
.ie-zoom{bottom:10px;left:50%;transform:translateX(-50%)}
.ie-zoom-val{min-width:54px;height:36px;padding:0 6px;border:0;border-radius:11px;background:transparent;color:var(--text);font-size:12px;font-weight:800;
  font-variant-numeric:tabular-nums;cursor:pointer}
.ie-zoom-val:hover{background:var(--pop-active)}
.ie-badge{top:10px;left:10px;gap:8px;padding:6px 10px;border-radius:12px;font-size:11px;font-weight:750;color:var(--text-2);font-variant-numeric:tabular-nums;pointer-events:none}
.ie-badge b{padding:2px 6px;border-radius:6px;background:${GRADIENT};color:#fff;font-size:10px;font-weight:900;letter-spacing:.04em}
.ie-ctx{bottom:58px;left:50%;transform:translateX(-50%);max-width:calc(100% - 20px);overflow-x:auto;scrollbar-width:none}
.ie-ctx::-webkit-scrollbar{display:none}
.ie-ctx-sep{flex:none;width:1px;height:20px;margin:0 2px;background:var(--line)}
.ie-textedit{position:absolute;z-index:8;margin:0;padding:0;border:1px dashed var(--field-focus);border-radius:2px;background:rgba(0,0,0,.2);outline:none;resize:none;
  overflow:hidden;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;caret-color:var(--field-focus)}
.ie-crop{position:absolute;inset:0;z-index:7;background:var(--ie-canvas)}
.ie-crop-actions{position:absolute;left:50%;bottom:14px;z-index:9;display:flex;gap:8px;transform:translateX(-50%)}

/* Dock */
.ie-dock{order:3;flex:none;display:flex;gap:6px;overflow-x:auto;padding:8px 10px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line);
  background:color-mix(in srgb,var(--bg) 90%,transparent);scrollbar-width:none}
.ie-dock::-webkit-scrollbar{display:none}
.ie-tool{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:64px;height:56px;border:1px solid transparent;border-radius:14px;
  background:transparent;color:var(--text-3);font-size:10.5px;font-weight:750;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .18s,color .18s,transform .15s}
.ie-tool:hover{background:var(--field-bg);color:var(--text)}
.ie-tool:active{transform:scale(.96)}
.ie-tool[aria-pressed="true"]{background:${GRADIENT};color:#fff;box-shadow:var(--btn-shadow)}

/* Panel */
.ie-panel{order:2;position:relative;flex:none;display:flex;flex-direction:column;min-height:0;height:min(46dvh,400px);border-top:1px solid var(--card-border);
  background:var(--pop-bg);-webkit-backdrop-filter:blur(26px) saturate(160%);backdrop-filter:blur(26px) saturate(160%);animation:ie-up .24s cubic-bezier(.22,1,.36,1)}
.ie-panel-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px 8px 14px;border-bottom:1px solid var(--line)}
.ie-panel-title{margin:0;font-size:13.5px;font-weight:800;letter-spacing:-.01em}
.ie-panel-actions{display:flex;align-items:center;gap:6px}
.ie-panel-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px;-webkit-overflow-scrolling:touch}
.ie-panel-body .ie-iconbtn{width:36px;height:36px}
.ie-tool-host,.ie-tool-host *{color:inherit!important}
@media(min-width:769px){
  .ie-main{flex-direction:row}
  .ie-dock{order:0;flex-direction:column;overflow-x:hidden;overflow-y:auto;width:80px;padding:12px 8px;border-top:0;border-right:1px solid var(--line)}
  .ie-tool{width:100%;height:60px}
  .ie-panel{height:auto;width:348px;border-top:0;border-left:1px solid var(--card-border);animation-name:ie-left}
}

/* Controls */
.ie-stack{display:flex;flex-direction:column;gap:16px}
.ie-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ie-label{display:block;margin:0 0 8px;color:var(--text-3);font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.ie-hint{margin:0;color:var(--text-3);font-size:12px;line-height:1.55}
.ie-divider{height:1px;margin:2px 0;background:var(--line)}
.ie-range-row{display:flex;flex-direction:column;gap:2px}
.ie-range-head{display:flex;align-items:center;justify-content:space-between;color:var(--text-2);font-size:12.5px;font-weight:700}
.ie-range-head span{color:var(--accent-text);font-variant-numeric:tabular-nums;font-weight:800}
.ie-range{width:100%;height:30px;margin:0;accent-color:#6D5CFF;cursor:pointer;background:transparent}
.ie-seg{display:flex;gap:4px;padding:4px;border:1px solid var(--field-border);border-radius:13px;background:var(--field-bg)}
.ie-seg button{flex:1;min-height:34px;padding:0 10px;border:0;border-radius:9px;background:transparent;color:var(--text-2);font-size:12.5px;font-weight:750;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:background .18s,color .18s}
.ie-seg button[aria-pressed="true"]{background:${GRADIENT};color:#fff}
.ie-seg button:disabled{opacity:.45;cursor:not-allowed}
.ie-chips{display:flex;flex-wrap:wrap;gap:6px}
.ie-chip{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border:1px solid var(--field-border);border-radius:999px;background:var(--field-bg);
  color:var(--text-2);font-size:12.5px;font-weight:750;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .18s,border-color .18s,color .18s}
.ie-chip:hover:not(:disabled){border-color:var(--field-border-hover);color:var(--text)}
.ie-chip[aria-pressed="true"]{background:${GRADIENT};border-color:transparent;color:#fff}
.ie-chip:disabled{opacity:.5;cursor:not-allowed}
.ie-swatches{display:flex;flex-wrap:wrap;gap:8px}
.ie-swatch{position:relative;display:block;width:28px;height:28px;padding:0;border:2px solid var(--field-border);border-radius:50%;cursor:pointer;overflow:hidden;-webkit-tap-highlight-color:transparent}
.ie-swatch[data-active="true"]{border-color:var(--text);box-shadow:0 0 0 3px var(--field-ring)}
.ie-swatch-custom{background:conic-gradient(#f43f5e,#f59e0b,#84cc16,#22d3ee,#6366f1,#d946ef,#f43f5e)}
.ie-swatch-custom input{position:absolute;inset:-6px;width:calc(100% + 12px);height:calc(100% + 12px);opacity:0;cursor:pointer}
.ie-swatch-none{background:linear-gradient(135deg,transparent 45%,var(--danger) 45%,var(--danger) 55%,transparent 55%),var(--field-bg-solid)}
.ie-grid{display:grid;gap:8px}
.ie-grid-shapes{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
.ie-grid-emoji{grid-template-columns:repeat(auto-fill,minmax(46px,1fr))}
.ie-grid-media{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
.ie-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:68px;padding:8px;border:1px solid var(--field-border);border-radius:14px;
  background:var(--field-bg);color:var(--text-2);font-size:11px;font-weight:750;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .18s,border-color .18s,transform .15s}
.ie-tile:hover:not(:disabled){border-color:var(--field-border-hover);background:var(--field-bg-focus);color:var(--text)}
.ie-tile:active:not(:disabled){transform:scale(.96)}
.ie-tile[aria-pressed="true"]{border-color:var(--field-focus);box-shadow:0 0 0 3px var(--field-ring)}
.ie-tile:disabled{opacity:.5;cursor:not-allowed}
.ie-emoji{display:grid;place-items:center;min-height:46px;border:1px solid transparent;border-radius:12px;background:var(--field-bg);font-size:26px;line-height:1;cursor:pointer;
  font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}
.ie-emoji:hover{border-color:var(--field-border-hover);background:var(--field-bg-focus)}
.ie-emoji:active{transform:scale(.92)}
.ie-thumb{position:relative;display:block;aspect-ratio:1/1;padding:0;border:1px solid var(--field-border);border-radius:14px;overflow:hidden;background:var(--field-bg-solid);cursor:pointer}
.ie-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.ie-thumb:hover{border-color:var(--field-focus)}
.ie-look{display:flex;flex-direction:column;align-items:center;gap:6px;width:68px;padding:0;border:0;background:transparent;color:var(--text-2);font-size:11px;font-weight:750;cursor:pointer}
.ie-look i{display:block;width:60px;height:60px;border:2px solid var(--field-border);border-radius:14px}
.ie-look[aria-pressed="true"]{color:var(--text)}
.ie-look[aria-pressed="true"] i{border-color:var(--field-focus);box-shadow:0 0 0 3px var(--field-ring)}
.ie-looks{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:thin}
.ie-layer{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 10px;border:1px solid var(--field-border);border-radius:14px;background:var(--field-bg);cursor:pointer;transition:background .18s,border-color .18s}
.ie-layer[data-selected="true"]{border-color:var(--field-focus);background:var(--pop-active);box-shadow:0 0 0 3px var(--field-ring)}
.ie-layer[data-hidden="true"]{opacity:.55}
.ie-layer-ico{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--pop-active);color:var(--accent-text)}
.ie-layer-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:700}
.ie-layer-actions{display:flex;align-items:center;gap:2px;flex:none}
.ie-layer-actions .ie-iconbtn{width:30px;height:30px;border-radius:9px;border-color:transparent;background:transparent}
.ie-layer-actions .ie-iconbtn svg{width:15px;height:15px}
.ie-hist-item{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:0 12px;border:1px solid var(--field-border);border-radius:12px;background:var(--field-bg);
  color:var(--text-2);font-size:13px;font-weight:700;text-align:left;cursor:pointer}
.ie-hist-item[aria-current="true"]{border-color:var(--field-focus);background:var(--pop-active);color:var(--text)}
.ie-hist-item[data-future="true"]{opacity:.55}
.ie-hist-item b{flex:none;width:22px;color:var(--text-3);font-size:11px;font-variant-numeric:tabular-nums}
.ie-hist-item span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ie-empty{padding:28px 10px;color:var(--text-3);font-size:13px;line-height:1.6;text-align:center}
.ie-fontgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.ie-fontbtn{min-height:38px;padding:0 10px;border:1px solid var(--field-border);border-radius:11px;background:var(--field-bg);color:var(--text);font-size:14px;text-align:left;cursor:pointer;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ie-fontbtn[aria-pressed="true"]{border-color:var(--field-focus);background:var(--pop-active);box-shadow:0 0 0 3px var(--field-ring)}
.ie-num{width:92px;min-height:38px;padding:0 10px;border:1px solid var(--field-border);border-radius:11px;background:var(--field-bg);color:var(--text);font:inherit;font-size:14px;font-weight:700;
  user-select:text;-webkit-user-select:text}
.ie-num:focus{outline:none;border-color:var(--field-focus);box-shadow:0 0 0 3px var(--field-ring)}

/* Dialogs + busy */
.ie-overlay{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;background:rgba(3,7,27,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ie-dialog{width:min(460px,100%);max-height:calc(100dvh - 32px);overflow-y:auto;padding:20px;border:1px solid var(--card-border);border-radius:24px;background:var(--pop-bg);box-shadow:var(--pop-shadow);outline:none}
.ie-dialog h3{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-size:17px;font-weight:800;letter-spacing:-.02em}
.ie-dialog-sub{margin:0 0 16px;color:var(--text-2);font-size:12.5px;line-height:1.5}
.ie-dialog-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.ie-dialog-actions>*{flex:1 1 130px}
.ie-busy{position:absolute;inset:0;z-index:95;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(3,7,27,.55);
  -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);color:#fff;font-size:13px;font-weight:700}

.ie-root button:focus-visible,.ie-root input:focus-visible,.ie-root textarea:focus-visible,.ie-root label:focus-within{outline:2px solid var(--focus-outline);outline-offset:2px}
.ie-root .ie-textedit:focus-visible,.ie-root .ie-swatch-custom:focus-within{outline:none}
@keyframes ie-up{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
@keyframes ie-left{from{transform:translateX(16px);opacity:0}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){.ie-root *,.ie-root *::before,.ie-root *::after{animation:none!important;transition-duration:.01ms!important}}
@media(forced-colors:active){.ie-panel,.ie-float,.ie-dialog,.ie-iconbtn,.ie-tool{border:1px solid CanvasText}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.ie-top,.ie-float,.ie-panel{background:var(--field-bg-solid)}}
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────────────────────── */

const FONT_LIST = [
  'Inter', 'Poppins', 'Playfair Display', 'Oswald', 'Lora',
  'Pacifico', 'Dancing Script', 'Bebas Neue', 'Anton', 'Caveat',
];

const EXPORT_PRESETS = {
  INSTAGRAM_SQUARE: { width: 1080, height: 1080, label: 'Instagram Square' },
  INSTAGRAM_PORTRAIT: { width: 1080, height: 1350, label: 'Instagram Portrait' },
  INSTAGRAM_STORY: { width: 1080, height: 1920, label: 'Story / Reel' },
  FULL_HD: { width: 1920, height: 1080, label: 'Full HD' },
  X_POST: { width: 1600, height: 900, label: 'Wide Post' },
  YOUTUBE_THUMB: { width: 1280, height: 720, label: 'Thumbnail' },
};

const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif' };
const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp', avif: 'avif' };

const HISTORY_LIMIT = 50;
const COALESCE_MS = 700;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;
const MAX_EXPORT_SIDE = 8192;
const MAX_EXPORT_AREA = 16777216; // iOS Safari canvas ceiling

const DEFAULT_ADJUSTMENTS = {
  brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0, temperature: 0, vignette: 0,
};

const SWATCHES = ['#FFFFFF', '#000000', '#FF3B5C', '#FF9F1C', '#FFD60A', '#34D399', '#22D3EE', '#4431F7', '#8B1EF3', '#F472B6'];

const SHAPES = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'star', label: 'Star' },
];

const STICKER_SETS = {
  Smileys: ['😀', '😂', '🥹', '😍', '😎', '🤩', '🥳', '😭', '😡', '🤯', '😴', '🤔', '🙌', '👏', '🙏', '💪', '👍', '👎', '🔥', '💯', '✨', '⭐', '🎉', '🎊'],
  Love: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💘', '💝', '💕', '😘', '🥰', '💋', '🌹', '💌', '💍', '👑', '💎', '🦋', '🌈', '☀️', '🌙'],
  Fun: ['🎈', '🎁', '🎂', '🍾', '🎵', '🎤', '🎧', '🎮', '⚽', '🏀', '🏆', '🚀', '✈️', '🛸', '👾', '🤖', '👻', '💀', '🦄', '🐉', '⚡', '💥', '💫', '🌟'],
  Nature: ['🌸', '🌺', '🌻', '🌴', '🌵', '🍀', '🍁', '🌊', '🏔️', '🌋', '🌍', '🐶', '🐱', '🦁', '🐼', '🦊', '🐯', '🐸', '🐧', '🦅', '🐝', '🐙', '🦋', '🐬'],
  Food: ['🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🍩', '🍪', '🍰', '🍦', '🍓', '🍉', '🍑', '🥑', '🍋', '🍇', '☕', '🧋', '🍺', '🍷', '🥂', '🍹', '🥤', '🍿'],
  Symbols: ['✅', '❌', '⚠️', '❗', '❓', '💡', '📌', '📍', '🔔', '📣', '💬', '🔒', '🔑', '➡️', '⬆️', '🔝', '🆕', '🆓', '🔴', '🟢', '🔵', '🟣', '🏁', '♾️'],
};

const LOOKS = [
  { id: 'none', label: 'Original', swatch: 'linear-gradient(135deg,#9aa4c7,#d5daf0)' },
  { id: 'vivid', label: 'Vivid', swatch: 'linear-gradient(135deg,#ff2d75,#ffb800,#00c2ff)' },
  { id: 'warm', label: 'Warm', swatch: 'linear-gradient(135deg,#ff9a3c,#ffd27a)' },
  { id: 'cool', label: 'Cool', swatch: 'linear-gradient(135deg,#3a7bd5,#7ad7f0)' },
  { id: 'vintage', label: 'Vintage', swatch: 'linear-gradient(135deg,#b08968,#e6ccb2)' },
  { id: 'fade', label: 'Fade', swatch: 'linear-gradient(135deg,#bfc3d0,#eef0f6)' },
  { id: 'dramatic', label: 'Dramatic', swatch: 'linear-gradient(135deg,#0f172a,#7c3aed)' },
  { id: 'cinematic', label: 'Cinema', swatch: 'linear-gradient(135deg,#0e7490,#f59e0b)' },
  { id: 'sunset', label: 'Sunset', swatch: 'linear-gradient(135deg,#f43f5e,#fb923c)' },
  { id: 'noir', label: 'Noir', swatch: 'linear-gradient(135deg,#111,#bbb)' },
  { id: 'grayscale', label: 'Mono', swatch: 'linear-gradient(135deg,#444,#ddd)' },
  { id: 'sepia', label: 'Sepia', swatch: 'linear-gradient(135deg,#704214,#e0c08a)' },
  { id: 'invert', label: 'Invert', swatch: 'linear-gradient(135deg,#00e5ff,#ff2d75)' },
];

const DOCK = [
  { id: 'select', label: 'Select', icon: IPointer },
  { id: 'crop', label: 'Crop', icon: ICrop },
  { id: 'adjust', label: 'Adjust', icon: ISliders },
  { id: 'filter', label: 'Filters', icon: IWand },
  { id: 'text', label: 'Text', icon: IType },
  { id: 'draw', label: 'Draw', icon: IPencil },
  { id: 'shape', label: 'Shapes', icon: IShapes },
  { id: 'sticker', label: 'Stickers', icon: ISmile },
  { id: 'photo', label: 'Photo', icon: IImagePlus },
  { id: 'layers', label: 'Layers', icon: ILayers },
  { id: 'history', label: 'History', icon: IHistory },
];

const PANEL_TITLES = {
  crop: 'Crop & Rotate', adjust: 'Adjust', filter: 'Filters', text: 'Text', draw: 'Draw', shape: 'Shapes',
  sticker: 'Stickers', photo: 'Add Photo', layers: 'Layers', history: 'History', props: 'Properties',
};

const EMPTY_POINTS = [];

/* ────────────────────────────────────────────────────────────────────────────
 * Pixel pipeline (shared by preview + export)
 * ──────────────────────────────────────────────────────────────────────────── */

const FILTER_FNS = {
  grayscale: (r, g, b, o) => { const y = 0.299 * r + 0.587 * g + 0.114 * b; o[0] = y; o[1] = y; o[2] = y; },
  noir: (r, g, b, o) => { const y = (0.299 * r + 0.587 * g + 0.114 * b - 128) * 1.3 + 122; o[0] = y; o[1] = y; o[2] = y; },
  sepia: (r, g, b, o) => {
    o[0] = 0.393 * r + 0.769 * g + 0.189 * b;
    o[1] = 0.349 * r + 0.686 * g + 0.168 * b;
    o[2] = 0.272 * r + 0.534 * g + 0.131 * b;
  },
  invert: (r, g, b, o) => { o[0] = 255 - r; o[1] = 255 - g; o[2] = 255 - b; },
  vintage: (r, g, b, o) => {
    const sr = 0.393 * r + 0.769 * g + 0.189 * b;
    const sg = 0.349 * r + 0.686 * g + 0.168 * b;
    const sb = 0.272 * r + 0.534 * g + 0.131 * b;
    o[0] = r * 0.4 + sr * 0.6 + 14; o[1] = g * 0.4 + sg * 0.6 + 9; o[2] = b * 0.4 + sb * 0.6 + 20;
  },
  warm: (r, g, b, o) => { o[0] = r + 18; o[1] = g + 4; o[2] = b - 16; },
  cool: (r, g, b, o) => { o[0] = r - 14; o[1] = g + 2; o[2] = b + 20; },
  vivid: (r, g, b, o) => {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    o[0] = (y + (r - y) * 1.35 - 128) * 1.08 + 128;
    o[1] = (y + (g - y) * 1.35 - 128) * 1.08 + 128;
    o[2] = (y + (b - y) * 1.35 - 128) * 1.08 + 128;
  },
  fade: (r, g, b, o) => {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    o[0] = (y + (r - y) * 0.85) * 0.86 + 26; o[1] = (y + (g - y) * 0.85) * 0.86 + 26; o[2] = (y + (b - y) * 0.85) * 0.86 + 28;
  },
  dramatic: (r, g, b, o) => {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    o[0] = (y + (r - y) * 0.85 - 128) * 1.35 + 120;
    o[1] = (y + (g - y) * 0.85 - 128) * 1.35 + 120;
    o[2] = (y + (b - y) * 0.85 - 128) * 1.35 + 124;
  },
  cinematic: (r, g, b, o) => {
    const t = (0.299 * r + 0.587 * g + 0.114 * b) / 255 - 0.5;
    o[0] = (r - 128) * 1.1 + 128 + t * 34; o[1] = (g - 128) * 1.1 + 128 + t * 6; o[2] = (b - 128) * 1.1 + 128 - t * 34;
  },
  sunset: (r, g, b, o) => {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    o[0] = y + (r - y) * 1.12 + 26; o[1] = y + (g - y) * 1.12 + 6; o[2] = y + (b - y) * 1.12 - 22;
  },
};

const FILTER_ALIASES = {
  bw: 'grayscale', blackwhite: 'grayscale', blackandwhite: 'grayscale', mono: 'grayscale', monochrome: 'grayscale',
  greyscale: 'grayscale', gray: 'grayscale', grey: 'grayscale', retro: 'vintage', old: 'vintage', sunny: 'warm',
  cold: 'cool', vibrant: 'vivid', pop: 'vivid', matte: 'fade', moody: 'dramatic', film: 'cinematic', cinema: 'cinematic',
  sunrise: 'sunset', negative: 'invert',
};

const getFilterFn = (id) => {
  if (!id || id === 'none') return null;
  const key = String(id).toLowerCase().replace(/[^a-z]/g, '');
  return FILTER_FNS[key] || FILTER_FNS[FILTER_ALIASES[key]] || null;
};

const natW = (img) => img.naturalWidth || img.width || 1;
const natH = (img) => img.naturalHeight || img.height || 1;

function blurCanvas(canvas, blurPx) {
  const W = canvas.width;
  const H = canvas.height;
  const out = createCanvas(W, H);
  const octx = out.getContext('2d');
  const supportsFilter = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
  if (supportsFilter) {
    const pad = Math.ceil(blurPx * 2);
    const tmp = createCanvas(W + pad * 2, H + pad * 2);
    const t = tmp.getContext('2d');
    t.drawImage(canvas, 0, 0, W, H, 0, 0, W + pad * 2, H + pad * 2); // edge underlay avoids dark/transparent borders
    t.drawImage(canvas, pad, pad);
    octx.filter = `blur(${blurPx}px)`;
    octx.drawImage(tmp, -pad, -pad);
    octx.filter = 'none';
    return out;
  }
  // Safari fallback: down/up-scale approximation
  const f = clamp(blurPx * 1.2, 1, 40);
  const small = createCanvas(Math.max(1, Math.ceil(W / f)), Math.max(1, Math.ceil(H / f)));
  small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(small, 0, 0, W, H);
  return out;
}

function renderProcessed(img, adj, filterId, intensity, outW, outH) {
  const W = Math.max(1, Math.round(outW || natW(img)));
  const H = Math.max(1, Math.round(outH || natH(img)));
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, W, H);

  const b = (adj.brightness || 0) / 100;
  const c = (adj.contrast || 0) / 100 + 1;
  const s = (adj.saturation || 0) / 100 + 1;
  const hue = adj.hue || 0;
  const temp = adj.temperature || 0;
  const vig = clamp((adj.vignette || 0) / 100, 0, 1);
  const fn = getFilterFn(filterId);
  const mix = clamp(intensity ?? 1, 0, 1);

  if (b !== 0 || c !== 1 || s !== 1 || hue !== 0 || temp !== 0 || vig > 0 || (fn && mix > 0)) {
    const image = ctx.getImageData(0, 0, W, H);
    const d = image.data;

    let m00 = 1, m01 = 0, m02 = 0, m10 = 0, m11 = 1, m12 = 0, m20 = 0, m21 = 0, m22 = 1;
    if (hue !== 0) {
      const rad = (hue * Math.PI) / 180;
      const cs = Math.cos(rad);
      const sn = Math.sin(rad);
      m00 = 0.213 + cs * 0.787 - sn * 0.213; m01 = 0.715 - cs * 0.715 - sn * 0.715; m02 = 0.072 - cs * 0.072 + sn * 0.928;
      m10 = 0.213 - cs * 0.213 + sn * 0.143; m11 = 0.715 + cs * 0.285 + sn * 0.140; m12 = 0.072 - cs * 0.072 - sn * 0.283;
      m20 = 0.213 - cs * 0.213 - sn * 0.787; m21 = 0.715 - cs * 0.715 + sn * 0.715; m22 = 0.072 + cs * 0.928 + sn * 0.072;
    }
    const out = [0, 0, 0];
    const cx = W / 2;
    const cy = H / 2;
    const maxD = Math.hypot(cx, cy) || 1;
    const brightOffset = 255 * b;
    const tempShift = temp * 0.4;

    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      let r = d[i];
      let g = d[i + 1];
      let bl = d[i + 2];
      if (b !== 0) { r += brightOffset; g += brightOffset; bl += brightOffset; }
      if (c !== 1) { r = (r - 128) * c + 128; g = (g - 128) * c + 128; bl = (bl - 128) * c + 128; }
      if (s !== 1) {
        const y = 0.299 * r + 0.587 * g + 0.114 * bl;
        r = y + (r - y) * s; g = y + (g - y) * s; bl = y + (bl - y) * s;
      }
      if (hue !== 0) {
        const nr = r * m00 + g * m01 + bl * m02;
        const ng = r * m10 + g * m11 + bl * m12;
        const nb = r * m20 + g * m21 + bl * m22;
        r = nr; g = ng; bl = nb;
      }
      if (temp !== 0) { r += tempShift; bl -= tempShift; }
      if (fn) {
        fn(r, g, bl, out);
        r += (out[0] - r) * mix; g += (out[1] - g) * mix; bl += (out[2] - bl) * mix;
      }
      if (vig > 0) {
        const x = p % W;
        const y = (p / W) | 0;
        const dd = Math.hypot(x - cx, y - cy) / maxD;
        const t = dd < 0.35 ? 0 : (dd - 0.35) / 0.65;
        const f = 1 - vig * t * t * 0.95;
        r *= f; g *= f; bl *= f;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = bl; // Uint8ClampedArray clamps + rounds
    }
    ctx.putImageData(image, 0, 0);
  }

  const blurPx = (adj.blur || 0) * (W / natW(img));
  if (blurPx > 0.3) return blurCanvas(canvas, blurPx);
  return canvas;
}

function buildHistogram(canvas) {
  const S = 96;
  const k = S / Math.max(canvas.width, canvas.height);
  const w = Math.max(1, Math.round(canvas.width * k));
  const h = Math.max(1, Math.round(canvas.height * k));
  const small = createCanvas(w, h);
  const ctx = small.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const bins = [new Uint32Array(64), new Uint32Array(64), new Uint32Array(64)];
  for (let i = 0; i < d.length; i += 4) {
    bins[0][d[i] >> 2]++; bins[1][d[i + 1] >> 2]++; bins[2][d[i + 2] >> 2]++;
  }
  let max = 1;
  bins.forEach((bin) => bin.forEach((v) => { if (v > max) max = v; }));
  return { bins, max };
}

function analyzeForAutoEnhance(img) {
  const S = 96;
  const k = S / Math.max(natW(img), natH(img));
  const w = Math.max(1, Math.round(natW(img) * k));
  const h = Math.max(1, Math.round(natH(img) * k));
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const hist = new Uint32Array(256);
  let sum = 0;
  let satSum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const y = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
    hist[y]++; sum += y;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    satSum += mx ? (mx - mn) / mx : 0;
    n++;
  }
  const pct = (p) => {
    const t = n * p;
    let a = 0;
    for (let i = 0; i < 256; i++) { a += hist[i]; if (a >= t) return i; }
    return 255;
  };
  const lo = pct(0.01);
  const hi = pct(0.99);
  const mean = sum / n;
  const sat = satSum / n;
  const k2 = clamp(232 / Math.max(40, hi - lo), 1, 1.55);
  const newMean = (mean - 128) * k2 + 128;
  return {
    brightness: clamp(Math.round(((122 - newMean) / 255) * 100), -28, 28),
    contrast: clamp(Math.round((k2 - 1) * 100), 0, 45),
    saturation: clamp(Math.round((0.4 - sat) * 100), 0, 26),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Layer descriptions shared by preview + export
 * ──────────────────────────────────────────────────────────────────────────── */

const SHAPE_COMPONENTS = { Rect, Circle, Ellipse, Star, RegularPolygon };

const shapeGeometry = (obj) => {
  const w = obj.width || 100;
  const h = obj.height || w;
  switch (obj.shapeType) {
    case 'circle': return { kind: 'Circle', attrs: { radius: w / 2 } };
    case 'ellipse': return { kind: 'Ellipse', attrs: { radiusX: w / 2, radiusY: h / 2 } };
    case 'star': return { kind: 'Star', attrs: { numPoints: 5, innerRadius: w * 0.22, outerRadius: w * 0.5 } };
    case 'triangle': return { kind: 'RegularPolygon', attrs: { sides: 3, radius: w / 2 } };
    default: return { kind: 'Rect', attrs: { width: w, height: h, cornerRadius: obj.cornerRadius || 0 } };
  }
};

const commonAttrs = (obj) => ({
  id: obj.id,
  x: obj.x || 0,
  y: obj.y || 0,
  rotation: obj.rotation || 0,
  scaleX: obj.scaleX ?? 1,
  scaleY: obj.scaleY ?? 1,
  opacity: obj.opacity ?? 1,
  visible: obj.visible !== false,
});

const TEXT_PASSTHROUGH = [
  'align', 'verticalAlign', 'fontStyle', 'textDecoration', 'letterSpacing', 'lineHeight', 'stroke', 'strokeWidth',
  'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'shadowOpacity', 'padding',
];

const textAttrs = (obj) => {
  const a = {
    text: obj.text ?? '',
    fontSize: obj.fontSize || 48,
    fontFamily: obj.fontFamily || 'Inter',
    fill: obj.fill || '#FFFFFF',
    width: obj.width || 300,
  };
  TEXT_PASSTHROUGH.forEach((k) => { if (obj[k] !== undefined && obj[k] !== null) a[k] = obj[k]; });
  return a;
};

const drawingAttrs = (obj) => ({
  points: obj.points || EMPTY_POINTS,
  stroke: obj.color || '#FFFFFF',
  strokeWidth: obj.brushSize || 5,
  tension: 0.4,
  lineCap: 'round',
  lineJoin: 'round',
  hitStrokeWidth: Math.max(obj.brushSize || 5, 24),
});

const buildExportNode = (obj, imageCache) => {
  const c = commonAttrs(obj);
  switch (obj.type) {
    case 'text': return new Konva.Text({ ...c, ...textAttrs(obj) });
    case 'shape': {
      const { kind, attrs } = shapeGeometry(obj);
      const Ctor = Konva[kind];
      return new Ctor({ ...c, ...attrs, fill: obj.fill, stroke: obj.stroke, strokeWidth: obj.strokeWidth });
    }
    case 'drawing': return new Konva.Line({ ...c, ...drawingAttrs(obj) });
    case 'image': {
      const img = imageCache[obj.id];
      return img ? new Konva.Image({ ...c, image: img, width: obj.width, height: obj.height }) : null;
    }
    default: return null;
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * Document reducer (labelled + coalescing history)
 * ──────────────────────────────────────────────────────────────────────────── */

const makeSnap = (s) => ({
  objects: s.objects,
  adjustments: s.adjustments,
  filter: s.filter,
  filterIntensity: s.filterIntensity,
  imageDimensions: s.imageDimensions,
  originalImage: s.originalImage,
  imageSrc: s.imageSrc,
});

const INITIAL_CROP = { position: { x: 0, y: 0 }, zoom: 1, aspect: undefined, areaPixels: null };

const INITIAL_DOCUMENT = {
  imageSrc: null,
  originalImage: null,
  imageDimensions: { width: 1, height: 1 },
  adjustments: DEFAULT_ADJUSTMENTS,
  filter: 'none',
  filterIntensity: 1,
  objects: [],
  selectedId: null,
  crop: INITIAL_CROP,
  history: { past: [], present: null, future: [] },
};

// Immutable updates mean snapshots can safely share structure (no cloning).
function commit(state, next, meta = {}) {
  const { label = 'Edit', key = null, time = 0 } = meta;
  const { past, present: cur } = state.history;
  const present = cur || { snap: makeSnap(state), label: 'Original', key: null, time: 0 };
  const entry = { snap: makeSnap(next), label, key, time };
  if (cur && key && present.key === key && time - present.time < COALESCE_MS) {
    return { ...next, history: { past, present: { ...entry, label: present.label }, future: [] } };
  }
  return { ...next, history: { past: [...past, present].slice(-HISTORY_LIMIT), present: entry, future: [] } };
}

const restore = (state, snap) => {
  const next = { ...state, ...snap };
  if (next.selectedId && !next.objects.some((o) => o.id === next.selectedId)) next.selectedId = null;
  return next;
};

function documentReducer(state, action) {
  const meta = action.meta || {};
  switch (action.type) {
    case 'INIT_DOCUMENT': {
      const { imageSrc, originalImage, width, height } = action.payload;
      const base = {
        ...INITIAL_DOCUMENT,
        imageSrc,
        originalImage,
        imageDimensions: { width, height },
        objects: [{
          id: 'bg-img', type: 'image', isBackground: true, name: 'Background', visible: true, locked: true,
          x: 0, y: 0, width, height, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        }],
      };
      return { ...base, history: { past: [], present: { snap: makeSnap(base), label: 'Original', key: null, time: 0 }, future: [] } };
    }
    case 'SET_ADJUSTMENT': {
      const { key, value } = action.payload;
      if (state.adjustments[key] === value) return state;
      return commit(state, { ...state, adjustments: { ...state.adjustments, [key]: value } },
        { ...meta, label: meta.label || 'Adjust', key: meta.key || `adj:${key}` });
    }
    case 'SET_ADJUSTMENTS':
      return commit(state, { ...state, adjustments: { ...state.adjustments, ...action.payload.values } },
        { ...meta, label: meta.label || 'Adjust' });
    case 'RESET_ADJUSTMENTS':
      return commit(state, { ...state, adjustments: DEFAULT_ADJUSTMENTS }, { ...meta, label: 'Reset adjustments' });
    case 'RESET_LOOK':
      return commit(state, { ...state, adjustments: DEFAULT_ADJUSTMENTS, filter: 'none', filterIntensity: 1 }, { ...meta, label: 'Reset look' });
    case 'SET_FILTER':
      if (state.filter === action.payload.filter) return state;
      return commit(state, { ...state, filter: action.payload.filter }, { ...meta, label: 'Filter' });
    case 'SET_FILTER_INTENSITY':
      return commit(state, { ...state, filterIntensity: action.payload.intensity }, { ...meta, label: 'Filter strength', key: 'filterIntensity' });
    case 'SELECT_OBJECT':
      if (state.selectedId === action.payload.id) return state;
      return { ...state, selectedId: action.payload.id };
    case 'ADD_OBJECT':
      return commit(state, { ...state, objects: [...state.objects, action.payload.object], selectedId: action.payload.object.id }, meta);
    case 'UPDATE_OBJECT': {
      const { id, patch } = action.payload;
      const obj = state.objects.find((o) => o.id === id);
      if (!obj) return state;
      if (!Object.keys(patch).some((k) => obj[k] !== patch[k])) return state;
      return commit(state, { ...state, objects: state.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }, meta);
    }
    case 'DELETE_OBJECT': {
      const { id } = action.payload;
      const obj = state.objects.find((o) => o.id === id);
      if (!obj || obj.isBackground) return state;
      return commit(state, {
        ...state,
        objects: state.objects.filter((o) => o.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }, { ...meta, label: meta.label || `Delete ${obj.name || obj.type}` });
    }
    case 'CLEAR_DRAWINGS': {
      if (!state.objects.some((o) => o.type === 'drawing')) return state;
      const objects = state.objects.filter((o) => o.type !== 'drawing');
      return commit(state, { ...state, objects, selectedId: objects.some((o) => o.id === state.selectedId) ? state.selectedId : null },
        { ...meta, label: 'Clear drawings' });
    }
    case 'DUPLICATE_OBJECT': {
      const { id, newId, offset } = action.payload;
      const idx = state.objects.findIndex((o) => o.id === id);
      if (idx === -1 || state.objects[idx].isBackground) return state;
      const src = state.objects[idx];
      const clone = {
        ...src, id: newId, name: `${src.name || src.type} copy`, locked: false,
        ...(src.type === 'drawing'
          ? { points: src.points.map((v) => v + offset) }
          : { x: (src.x || 0) + offset, y: (src.y || 0) + offset }),
      };
      const objects = [...state.objects];
      objects.splice(idx + 1, 0, clone);
      return commit(state, { ...state, objects, selectedId: newId }, { ...meta, label: 'Duplicate' });
    }
    case 'TOGGLE_VISIBILITY':
      return commit(state, { ...state, objects: state.objects.map((o) => (o.id === action.payload.id && !o.isBackground ? { ...o, visible: o.visible === false } : o)) },
        { ...meta, label: 'Toggle visibility' });
    case 'TOGGLE_LOCK':
      return commit(state, { ...state, objects: state.objects.map((o) => (o.id === action.payload.id && !o.isBackground ? { ...o, locked: !o.locked } : o)) },
        { ...meta, label: 'Toggle lock' });
    case 'REORDER_OBJECT': {
      const { id, dir } = action.payload;
      const idx = state.objects.findIndex((o) => o.id === id);
      if (idx < 1) return state;
      const last = state.objects.length - 1;
      let to = idx;
      if (dir === 'up') to = Math.min(last, idx + 1);
      else if (dir === 'down') to = Math.max(1, idx - 1);
      else if (dir === 'top') to = last;
      else if (dir === 'bottom') to = 1;
      if (to === idx) return state;
      const objects = [...state.objects];
      const [moved] = objects.splice(idx, 1);
      objects.splice(to, 0, moved);
      return commit(state, { ...state, objects }, { ...meta, label: 'Reorder layer' });
    }
    case 'RESET_CROP':
      return { ...state, crop: INITIAL_CROP };
    case 'SET_CROP':
      return { ...state, crop: { ...state.crop, position: action.payload.position } };
    case 'SET_CROP_ZOOM':
      return { ...state, crop: { ...state.crop, zoom: action.payload.zoom } };
    case 'SET_CROP_ASPECT':
      return { ...state, crop: { ...state.crop, aspect: action.payload.aspect } };
    case 'SET_CROP_AREA_PIXELS':
      return { ...state, crop: { ...state.crop, areaPixels: action.payload.areaPixels } };
    case 'APPLY_CROP': {
      const { newImage, objects, width, height } = action.payload;
      return commit(state, {
        ...state, originalImage: newImage, imageSrc: newImage.src, imageDimensions: { width, height },
        objects, selectedId: null, crop: INITIAL_CROP,
      }, { ...meta, label: 'Crop & rotate' });
    }
    case 'UNDO': {
      const { past, present, future } = state.history;
      if (past.length === 0 || !present) return state;
      const prev = past[past.length - 1];
      return { ...restore(state, prev.snap), history: { past: past.slice(0, -1), present: prev, future: [present, ...future] } };
    }
    case 'REDO': {
      const { past, present, future } = state.history;
      if (future.length === 0 || !present) return state;
      const next = future[0];
      return { ...restore(state, next.snap), history: { past: [...past, present], present: next, future: future.slice(1) } };
    }
    case 'JUMP_HISTORY': {
      const { past, present, future } = state.history;
      const timeline = [...past, present, ...future].filter(Boolean);
      const idx = action.payload.index;
      if (idx < 0 || idx >= timeline.length || idx === past.length) return state;
      return {
        ...restore(state, timeline[idx].snap),
        history: { past: timeline.slice(0, idx), present: timeline[idx], future: timeline.slice(idx + 1) },
      };
    }
    default:
      return state;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small UI building blocks
 * ──────────────────────────────────────────────────────────────────────────── */

const toHex = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#ffffff');

const resolutionBadge = (w, h) => {
  const m = Math.max(w, h);
  if (m >= 3840) return '4K';
  if (m >= 2560) return '2K';
  if (m >= 1920) return 'FHD';
  if (m >= 1280) return 'HD';
  return 'SD';
};

const Range = memo(function Range({ id, label, value, min, max, step = 1, onChange, format, disabled }) {
  return (
    <div className="ie-range-row">
      <div className="ie-range-head">
        <label htmlFor={id}>{label}</label>
        <span>{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        className="ie-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
});

const ColorField = memo(function ColorField({ label, value, onChange, allowNone }) {
  return (
    <div>
      <span className="ie-label">{label}</span>
      <div className="ie-swatches" role="group" aria-label={label}>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className="ie-swatch"
            data-active={String(value || '').toLowerCase() === c.toLowerCase()}
            style={{ background: c }}
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
          />
        ))}
        <label className="ie-swatch ie-swatch-custom" title="Custom colour">
          <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} aria-label={`${label} custom`} />
        </label>
        {allowNone && (
          <button type="button" className="ie-swatch ie-swatch-none" aria-label={`${label} none`} data-active={value === 'transparent' || !value} onClick={() => onChange('transparent')} />
        )}
      </div>
    </div>
  );
});

const PanelShell = ({ title, onClose, actions, children }) => (
  <aside className="ie-panel" aria-label={title}>
    <div className="ie-panel-head">
      <h2 className="ie-panel-title">{title}</h2>
      <div className="ie-panel-actions">
        {actions}
        <button type="button" className="ie-iconbtn" onClick={onClose} aria-label={`Close ${title}`}>
          <IClose size={18} />
        </button>
      </div>
    </div>
    <div className="ie-panel-body">{children}</div>
  </aside>
);

const Histogram = memo(function Histogram({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !data) return;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const colors = ['rgba(255,70,90,0.85)', 'rgba(60,220,140,0.85)', 'rgba(70,120,255,0.9)'];
    const bw = w / 64;
    data.bins.forEach((bin, ci) => {
      ctx.fillStyle = colors[ci];
      for (let i = 0; i < 64; i++) {
        const bh = Math.round(Math.sqrt(bin[i] / data.max) * h);
        ctx.fillRect(i * bw, h - bh, bw + 0.5, bh);
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }, [data]);
  return <canvas ref={ref} width={128} height={48} className="ie-hist" role="img" aria-label="RGB histogram" />;
});

const FontPicker = ({ current, onSelect }) => {
  const handleSelect = async (font) => {
    try { await document.fonts.load(`16px "${font}"`); } catch { /* font may be unavailable – still apply */ }
    onSelect(font);
  };
  return (
    <div>
      <span className="ie-label">Font</span>
      <div className="ie-fontgrid">
        {FONT_LIST.map((font) => (
          <button
            key={font}
            type="button"
            className="ie-fontbtn"
            aria-pressed={current === font}
            style={{ fontFamily: `"${font}", sans-serif` }}
            onClick={() => handleSelect(font)}
          >
            {font}
          </button>
        ))}
      </div>
    </div>
  );
};

const ExportDialog = memo(function ExportDialog({ onClose, onExport, naturalW, naturalH, formats, defaultFormat, busy }) {
  const [format, setFormat] = useState(formats.includes(defaultFormat) ? defaultFormat : 'png');
  const [quality, setQuality] = useState(0.92);
  const [preset, setPreset] = useState('original');
  const [w, setW] = useState(naturalW);
  const [h, setH] = useState(naturalH);
  const [lock, setLock] = useState(true);
  const [fit, setFit] = useState('contain');
  const [bg, setBg] = useState('auto');
  const ratio = naturalW / naturalH;

  const dims = preset === 'original'
    ? { w: naturalW, h: naturalH }
    : preset === 'custom'
      ? { w, h }
      : { w: EXPORT_PRESETS[preset].width, h: EXPORT_PRESETS[preset].height };
  const mismatch = Math.abs(dims.w / dims.h - ratio) > 0.01;

  const setWidth = (v) => {
    const nv = clamp(Math.round(v || 0), 16, MAX_EXPORT_SIDE);
    setW(nv);
    if (lock) setH(clamp(Math.round(nv / ratio), 16, MAX_EXPORT_SIDE));
  };
  const setHeight = (v) => {
    const nv = clamp(Math.round(v || 0), 16, MAX_EXPORT_SIDE);
    setH(nv);
    if (lock) setW(clamp(Math.round(nv * ratio), 16, MAX_EXPORT_SIDE));
  };
  const options = { format, quality, width: dims.w, height: dims.h, fit, background: bg };

  return (
    <motion.div
      className="ie-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); } }}
    >
      <FocusTrap focusTrapOptions={{ allowOutsideClick: true, escapeDeactivates: false, fallbackFocus: '.ie-dialog' }}>
        <motion.div
          className="ie-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ie-export-title"
          tabIndex={-1}
          initial={{ scale: 0.94, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        >
          <h3 id="ie-export-title"><IDownload size={20} /> Export</h3>
          <p className="ie-dialog-sub">{naturalW} × {naturalH} source · output {dims.w} × {dims.h}</p>

          <div className="ie-stack">
            <div>
              <span className="ie-label">Format</span>
              <div className="ie-seg" role="group" aria-label="Format">
                {['png', 'jpeg', 'webp', 'avif'].map((f) => (
                  <button key={f} type="button" aria-pressed={format === f} disabled={!formats.includes(f)} onClick={() => setFormat(f)}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {format !== 'png' && (
              <Range id="ie-exp-q" label="Quality" value={quality} min={0.1} max={1} step={0.01} onChange={setQuality} format={(v) => `${Math.round(v * 100)}%`} />
            )}

            <div>
              <span className="ie-label">Size</span>
              <div className="ie-chips">
                <button type="button" className="ie-chip" aria-pressed={preset === 'original'} onClick={() => setPreset('original')}>Original</button>
                {Object.entries(EXPORT_PRESETS).map(([k, v]) => (
                  <button key={k} type="button" className="ie-chip" aria-pressed={preset === k} onClick={() => setPreset(k)}>{v.label}</button>
                ))}
                <button
                  type="button"
                  className="ie-chip"
                  aria-pressed={preset === 'custom'}
                  onClick={() => { setPreset('custom'); setW(naturalW); setH(naturalH); }}
                >
                  Custom
                </button>
              </div>
              {preset === 'custom' && (
                <div className="ie-row" style={{ marginTop: 10 }}>
                  <input className="ie-num" type="number" inputMode="numeric" aria-label="Width" value={w} min={16} max={MAX_EXPORT_SIDE} onChange={(e) => setWidth(Number(e.target.value))} />
                  <span style={{ color: 'var(--text-3)' }}>×</span>
                  <input className="ie-num" type="number" inputMode="numeric" aria-label="Height" value={h} min={16} max={MAX_EXPORT_SIDE} onChange={(e) => setHeight(Number(e.target.value))} />
                  <button type="button" className="ie-iconbtn" aria-pressed={lock} data-active={lock} onClick={() => setLock(!lock)} aria-label="Lock aspect ratio">
                    {lock ? <ILock size={16} /> : <IUnlock size={16} />}
                  </button>
                </div>
              )}
            </div>

            {mismatch && (
              <>
                <div>
                  <span className="ie-label">Fit</span>
                  <div className="ie-seg" role="group" aria-label="Fit">
                    <button type="button" aria-pressed={fit === 'contain'} onClick={() => setFit('contain')}>Contain</button>
                    <button type="button" aria-pressed={fit === 'cover'} onClick={() => setFit('cover')}>Fill &amp; crop</button>
                  </div>
                </div>
                {fit === 'contain' && (
                  <div>
                    <span className="ie-label">Background</span>
                    <div className="ie-seg" role="group" aria-label="Background">
                      {[['auto', 'Auto'], ['#FFFFFF', 'White'], ['#000000', 'Black'], ['#03071B', 'Midnight']].map(([v, l]) => (
                        <button key={v} type="button" aria-pressed={bg === v} onClick={() => setBg(v)}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="ie-dialog-actions">
            <button type="button" className="ie-btn-sec" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="ie-btn-sec" onClick={() => onExport('download', options)} disabled={busy}>
              <IDownload size={16} /> Download
            </button>
            <button type="button" className="ie-btn" onClick={() => onExport('post', options)} disabled={busy}>
              <ICheck size={16} /> Use in post
            </button>
          </div>
        </motion.div>
      </FocusTrap>
    </motion.div>
  );
});

const ConfirmDialog = memo(function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  return (
    <motion.div
      className="ie-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
    >
      <FocusTrap focusTrapOptions={{ allowOutsideClick: true, escapeDeactivates: false, fallbackFocus: '.ie-dialog' }}>
        <motion.div
          className="ie-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ie-confirm-title"
          aria-describedby="ie-confirm-body"
          tabIndex={-1}
          style={{ width: 'min(380px,100%)' }}
          initial={{ scale: 0.94, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 16, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        >
          <h3 id="ie-confirm-title">{title}</h3>
          <p id="ie-confirm-body" className="ie-dialog-sub">{body}</p>
          <div className="ie-dialog-actions" style={{ marginTop: 8 }}>
            <button type="button" className="ie-btn-sec" onClick={onCancel} autoFocus>{cancelLabel}</button>
            <button type="button" className="ie-btn-danger" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </motion.div>
      </FocusTrap>
    </motion.div>
  );
});

const detectFormats = () => {
  const out = ['png', 'jpeg'];
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    ['webp', 'avif'].forEach((f) => { if (c.toDataURL(MIME[f]).startsWith(`data:${MIME[f]}`)) out.push(f); });
  } catch { /* canvas unavailable */ }
  return out;
};

const guessFormat = (media) => {
  const f = media?.file;
  const hint = (f && (f.type || f.name)) || (typeof f === 'string' ? f : '') || media?.url || '';
  return /jpe?g/i.test(String(hint)) ? 'jpeg' : 'png';
};

/* ────────────────────────────────────────────────────────────────────────────
 * Editor
 * ──────────────────────────────────────────────────────────────────────────── */

const ImageEditor = forwardRef(function ImageEditor({ media, onClose, onSave, additionalMedia = [] }, ref) {
  const { isDark, toggleTheme, theme } = useTheme();
  const rootVars = isDark ? THEMES.dark : THEMES.light;
  const isMobile = useMediaQuery('(max-width: 768px)');

  /* ── state ─────────────────────────────────────────────────────────────── */
  const [doc, rawDispatch] = useReducer(documentReducer, INITIAL_DOCUMENT);
  const dispatchDoc = useCallback((action) => {
    rawDispatch({ ...action, meta: { ...(action.meta || {}), time: Date.now() } });
  }, []);

  const [imageCache, setImageCache] = useState({});
  const [processed, setProcessed] = useState(null);
  const [hist, setHist] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [tool, setTool] = useState('select');
  const [handMode, setHandMode] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [snap, setSnap] = useState({ vx: null, hy: null });

  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [pendingEdit, setPendingEdit] = useState(null);

  const [drawColor, setDrawColor] = useState('#FFFFFF');
  const [drawBrushSize, setDrawBrushSize] = useState(5);
  const [brushKind, setBrushKind] = useState('pen');
  const [shapeStyle, setShapeStyle] = useState({ fill: '#8B1EF3', stroke: '#FFFFFF', strokeWidth: 0 });
  const [stickerSet, setStickerSet] = useState('Smileys');
  const [cropRotation, setCropRotation] = useState(0);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fitMode, setFitMode] = useState('fit');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [workspaceEl, setWorkspaceEl] = useState(null);

  const [busy, setBusy] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  /* ── refs ──────────────────────────────────────────────────────────────── */
  const stageRef = useRef(null);
  const worldGroupRef = useRef(null);
  const transformerRef = useRef(null);
  const workspaceRef = useRef(null);
  const textRef = useRef(null);
  const dockRef = useRef(null);
  const fileInputRef = useRef(null);
  const drawingLineRef = useRef(null);
  const isDrawingRef = useRef(false);
  const drawingPointsRef = useRef([]);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const editSession = useRef(null);
  const editValueRef = useRef('');
  const lastAddRef = useRef(0);
  const objectUrlsRef = useRef([]);
  const imagesRef = useRef([]);
  const viewRef = useRef({});
  const latest = useRef({});
  const docRef = useRef(doc);
  const imageCacheRef = useRef(imageCache);
  docRef.current = doc;
  imageCacheRef.current = imageCache;

  const formats = useMemo(() => detectFormats(), []);
  const defaultFormat = useMemo(() => guessFormat(media), [media]);

  /* ── derived document values ───────────────────────────────────────────── */
  const bgW = doc.imageDimensions.width;
  const bgH = doc.imageDimensions.height;
  const selObj = doc.objects.find((o) => o.id === doc.selectedId) || null;
  const isDirty = doc.history.past.length > 0;
  const cropMode = tool === 'crop';
  const selectMode = !handMode && !spaceDown && tool !== 'draw' && tool !== 'crop';
  const panActive = handMode || spaceDown;
  const panelOpen = Object.prototype.hasOwnProperty.call(PANEL_TITLES, tool);

  /* ── viewport math ─────────────────────────────────────────────────────── */
  const midW = containerSize.width;
  const midH = containerSize.height;
  const fitPad = isMobile ? 12 : 32;
  const baseScale = useMemo(() => {
    if (midW <= 0 || midH <= 0) return 1;
    if (fitMode === 'actual') return 1;
    return Math.max(0.0001, Math.min((midW - fitPad * 2) / bgW, (midH - fitPad * 2) / bgH));
  }, [midW, midH, bgW, bgH, fitMode, fitPad]);
  const effScale = baseScale * zoom;
  const viewportX = (midW - bgW * effScale) / 2 + pan.x;
  const viewportY = (midH - bgH * effScale) / 2 + pan.y;
  viewRef.current = { zoom, pan, baseScale, midW, midH, bgW, bgH };

  const setViewZoomAt = useCallback((newZoom, cx, cy) => {
    const v = viewRef.current;
    const z = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
    const oldEff = v.baseScale * v.zoom;
    const newEff = v.baseScale * z;
    const curX = (v.midW - v.bgW * oldEff) / 2 + v.pan.x;
    const curY = (v.midH - v.bgH * oldEff) / 2 + v.pan.y;
    const wx = (cx - curX) / oldEff;
    const wy = (cy - curY) / oldEff;
    const nextPan = {
      x: cx - wx * newEff - (v.midW - v.bgW * newEff) / 2,
      y: cy - wy * newEff - (v.midH - v.bgH * newEff) / 2,
    };
    viewRef.current = { ...v, zoom: z, pan: nextPan };
    setZoom(z);
    setPan(nextPan);
  }, []);

  const zoomBy = useCallback((factor) => {
    const v = viewRef.current;
    setViewZoomAt(v.zoom * factor, v.midW / 2, v.midH / 2);
  }, [setViewZoomAt]);

  const fitView = useCallback(() => {
    setFitMode('fit');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const actualSize = useCallback(() => {
    setFitMode('actual');
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const viewCenterWorld = useCallback(() => {
    const v = viewRef.current;
    const eff = v.baseScale * v.zoom;
    const vx = (v.midW - v.bgW * eff) / 2 + v.pan.x;
    const vy = (v.midH - v.bgH * eff) / 2 + v.pan.y;
    return { x: clamp((v.midW / 2 - vx) / eff, 0, v.bgW), y: clamp((v.midH / 2 - vy) / eff, 0, v.bgH) };
  }, []);

  /* ── effects ───────────────────────────────────────────────────────────── */

  // Lock page scroll + warn before leaving with unsaved edits
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  // Revoke blob URLs / images on unmount
  useEffect(() => () => {
    objectUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* noop */ } });
    imagesRef.current.forEach((i) => { try { cleanupImage(i); } catch { /* noop */ } });
  }, []);

  // Load primary image
  const mediaSrc = media?.file || media?.url || media?.preview || null;
  useEffect(() => {
    if (!media) return undefined;
    if (!mediaSrc) { setLoadError(true); return undefined; }
    let cancelled = false;
    setLoadError(false);
    (async () => {
      try {
        const img = await loadImage(mediaSrc);
        if (cancelled) return;
        imagesRef.current.push(img);
        dispatchDoc({
          type: 'INIT_DOCUMENT',
          payload: { imageSrc: img.src, originalImage: img, width: natW(img), height: natH(img) },
        });
      } catch {
        if (cancelled) return;
        setLoadError(true);
        toast.error('Failed to load image');
      }
    })();
    return () => { cancelled = true; };
  }, [mediaSrc, media, reloadToken, dispatchDoc]);

  // Measure the workspace (callback ref → works even though it mounts after load)
  const setWs = useCallback((el) => { workspaceRef.current = el; setWorkspaceEl(el); }, []);
  useEffect(() => {
    if (!workspaceEl) return undefined;
    const measure = (w, h) => setContainerSize((p) => (Math.abs(p.width - w) < 0.5 && Math.abs(p.height - h) < 0.5 ? p : { width: w, height: h }));
    const r = workspaceEl.getBoundingClientRect();
    measure(r.width, r.height);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width, entry.contentRect.height));
    ro.observe(workspaceEl);
    return () => ro.disconnect();
  }, [workspaceEl]);

  // Re-fit when the canvas size changes (crop)
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [bgW, bgH]);

  // Wheel zoom (native, non-passive so the page never scrolls)
  useEffect(() => {
    const el = workspaceEl;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016));
      setViewZoomAt(viewRef.current.zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [workspaceEl, setViewZoomAt]);

  // Live preview: sharper when zoomed in, throttled to animation frames
  const lowMemory = typeof navigator !== 'undefined' && !!navigator.deviceMemory && navigator.deviceMemory < 4;
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const need = Math.max(bgW, bgH) * Math.min(1, effScale * dpr);
  const previewDim = useMemo(() => {
    const cap = lowMemory ? 1800 : 3200;
    const buckets = [1200, 1800, 2600, 3200].filter((b) => b <= cap);
    return buckets.find((b) => b >= need) || buckets[buckets.length - 1];
  }, [need, lowMemory]);

  useEffect(() => {
    if (!doc.originalImage) return undefined;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const scale = Math.min(1, previewDim / Math.max(bgW, bgH));
        const canvas = renderProcessed(
          doc.originalImage, doc.adjustments, doc.filter, doc.filterIntensity,
          Math.max(1, Math.round(bgW * scale)), Math.max(1, Math.round(bgH * scale)),
        );
        if (cancelled) return;
        setProcessed(canvas);
        setHist(buildHistogram(canvas));
      } catch (err) {
        console.error('Preview render failed', err);
      }
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [doc.originalImage, doc.adjustments, doc.filter, doc.filterIntensity, bgW, bgH, previewDim]);

  // Transformer follows selection
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const eligible = selObj && !selObj.locked && !selObj.isBackground && selObj.visible !== false
      && selectMode && !editingId && !showOriginal;
    if (eligible) {
      const node = stage.findOne(`#${selObj.id}`);
      tr.nodes(node ? [node] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [doc.selectedId, doc.objects, selObj, selectMode, editingId, showOriginal, containerSize]);

  // Dock keeps the active tool in view
  useEffect(() => {
    const el = dockRef.current?.querySelector('[aria-pressed="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [tool]);

  /* ── object helpers ────────────────────────────────────────────────────── */
  const addObj = useCallback((type, props = {}, label) => {
    const id = props.id || uuidv4();
    const object = {
      type, name: type, visible: true, locked: false, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, x: 0, y: 0,
      ...props, id,
    };
    dispatchDoc({ type: 'ADD_OBJECT', payload: { object }, meta: { label: label || `Add ${object.name}` } });
    return id;
  }, [dispatchDoc]);

  const updObj = useCallback((id, patch, opts = {}) => {
    dispatchDoc({
      type: 'UPDATE_OBJECT',
      payload: { id, patch },
      meta: {
        label: opts.label || 'Edit layer',
        key: opts.coalesce ? `obj:${id}:${typeof opts.coalesce === 'string' ? opts.coalesce : Object.keys(patch).sort().join(',')}` : null,
      },
    });
  }, [dispatchDoc]);

  const selectObject = useCallback((id) => dispatchDoc({ type: 'SELECT_OBJECT', payload: { id } }), [dispatchDoc]);

  const delObj = useCallback((id) => {
    const o = docRef.current.objects.find((x) => x.id === id);
    if (!o || o.isBackground) return;
    if (o.locked) { toast.info('Layer is locked'); return; }
    dispatchDoc({ type: 'DELETE_OBJECT', payload: { id } });
  }, [dispatchDoc]);

  const dupObj = useCallback((id) => {
    const d = docRef.current;
    const o = d.objects.find((x) => x.id === id);
    if (!o || o.isBackground) return;
    const newId = uuidv4();
    const offset = Math.round(Math.min(d.imageDimensions.width, d.imageDimensions.height) * 0.03);
    if (o.type === 'image') setImageCache((p) => (p[id] ? { ...p, [newId]: p[id] } : p));
    dispatchDoc({ type: 'DUPLICATE_OBJECT', payload: { id, newId, offset } });
  }, [dispatchDoc]);

  const toggleVis = useCallback((id) => dispatchDoc({ type: 'TOGGLE_VISIBILITY', payload: { id } }), [dispatchDoc]);
  const toggleLock = useCallback((id) => dispatchDoc({ type: 'TOGGLE_LOCK', payload: { id } }), [dispatchDoc]);
  const reorder = useCallback((id, dir) => dispatchDoc({ type: 'REORDER_OBJECT', payload: { id, dir } }), [dispatchDoc]);
  const undo = useCallback(() => dispatchDoc({ type: 'UNDO' }), [dispatchDoc]);
  const redo = useCallback(() => dispatchDoc({ type: 'REDO' }), [dispatchDoc]);

  const baseUnit = () => Math.min(docRef.current.imageDimensions.width, docRef.current.imageDimensions.height);

  const addTextAt = useCallback((x, y) => {
    const base = baseUnit();
    const fontSize = Math.round(base * 0.08);
    const width = Math.round(base * 0.45);
    const id = addObj('text', {
      name: 'Text', x: x - width / 2, y: y - fontSize / 2, text: 'Text', fontSize, fontFamily: 'Inter', fill: '#FFFFFF',
      width, align: 'center', shadowColor: 'rgba(0,0,0,0.45)', shadowBlur: Math.round(base * 0.008), shadowOpacity: 1,
    }, 'Add text');
    setPendingEdit(id);
    return id;
  }, [addObj]);

  const addShape = useCallback((shapeType) => {
    const base = baseUnit();
    const size = Math.round(base * 0.28);
    const c = viewCenterWorld();
    const label = SHAPES.find((s) => s.id === shapeType)?.label || 'Shape';
    const isRect = shapeType === 'rect';
    addObj('shape', {
      name: label, shapeType,
      x: isRect ? c.x - size / 2 : c.x, y: isRect ? c.y - size / 2 : c.y,
      width: size, height: shapeType === 'ellipse' ? Math.round(size * 0.66) : size,
      fill: shapeStyle.fill, stroke: shapeStyle.stroke, strokeWidth: shapeStyle.strokeWidth,
    }, `Add ${label.toLowerCase()}`);
    setTool('select');
  }, [addObj, shapeStyle, viewCenterWorld]);

  const addSticker = useCallback((emoji) => {
    const base = baseUnit();
    const fontSize = Math.round(base * 0.2);
    const c = viewCenterWorld();
    const width = Math.round(fontSize * 1.5);
    addObj('text', { name: 'Sticker', text: emoji, fontSize, fontFamily: 'sans-serif', fill: '#FFFFFF', width, align: 'center', x: c.x - width / 2, y: c.y - fontSize / 2 }, 'Add sticker');
  }, [addObj, viewCenterWorld]);

  const addImageFromSrc = useCallback(async (src, label) => {
    try {
      const img = await loadImage(src);
      imagesRef.current.push(img);
      const d = docRef.current;
      const W = d.imageDimensions.width;
      const H = d.imageDimensions.height;
      const iw = natW(img);
      const ih = natH(img);
      const s = Math.min(1, (W * 0.5) / iw, (H * 0.5) / ih);
      const w = Math.round(iw * s);
      const h = Math.round(ih * s);
      const id = uuidv4();
      setImageCache((p) => ({ ...p, [id]: img }));
      addObj('image', { id, name: label || 'Photo', x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), width: w, height: h }, 'Add photo');
      return true;
    } catch {
      toast.error('Failed to add photo');
      return false;
    }
  }, [addObj]);

  const handleFiles = useCallback(async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) { toast.error('Please choose an image'); return; }
    for (const f of list) {
      const url = URL.createObjectURL(f);
      objectUrlsRef.current.push(url);
      // eslint-disable-next-line no-await-in-loop
      await addImageFromSrc(url, f.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Photo');
    }
    toast.success(list.length > 1 ? `${list.length} photos added` : 'Photo added');
  }, [addImageFromSrc]);

  /* ── text editing ──────────────────────────────────────────────────────── */
  const startEdit = useCallback((id) => {
    const o = docRef.current.objects.find((x) => x.id === id);
    if (!o || o.type !== 'text' || o.locked) return;
    editSession.current = { id };
    editValueRef.current = o.text ?? '';
    setEditValue(o.text ?? '');
    setEditingId(id);
  }, []);

  const commitEdit = useCallback(() => {
    const s = editSession.current;
    if (!s) return;
    editSession.current = null;
    const value = editValueRef.current;
    setEditingId(null);
    const o = docRef.current.objects.find((x) => x.id === s.id);
    if (!o) return;
    if (!value.trim()) {
      dispatchDoc({ type: 'DELETE_OBJECT', payload: { id: s.id }, meta: { label: 'Delete empty text' } });
    } else if (value !== o.text) {
      updObj(s.id, { text: value, name: value.replace(/\s+/g, ' ').slice(0, 22) }, { label: 'Edit text' });
    }
  }, [dispatchDoc, updObj]);

  useEffect(() => {
    if (pendingEdit && doc.objects.some((o) => o.id === pendingEdit)) {
      const id = pendingEdit;
      setPendingEdit(null);
      startEdit(id);
    }
  }, [pendingEdit, doc.objects, startEdit]);

  useEffect(() => {
    if (!editingId) return;
    const t = textRef.current;
    if (!t) return;
    t.focus();
    t.select();
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
  }, [editingId]);

  /* ── tools ─────────────────────────────────────────────────────────────── */
  const initCrop = useCallback(() => {
    dispatchDoc({ type: 'RESET_CROP' });
    setCropRotation(0);
    setHandMode(false);
    selectObject(null);
    setTool('crop');
  }, [dispatchDoc, selectObject]);

  const openTool = useCallback((id) => {
    if (id === 'crop') { if (tool === 'crop') setTool('select'); else initCrop(); return; }
    setHandMode(false);
    if (id === 'draw' || id === 'text') selectObject(null);
    setTool((prev) => (prev === id && id !== 'select' ? 'select' : id));
  }, [tool, initCrop, selectObject]);

  const handleCropComplete = useCallback((_, pixels) => {
    dispatchDoc({ type: 'SET_CROP_AREA_PIXELS', payload: { areaPixels: pixels } });
  }, [dispatchDoc]);

  const applyCrop = useCallback(async () => {
    const d = docRef.current;
    const area = d.crop.areaPixels;
    const src = d.originalImage;
    if (!area || !src) { toast.info('Adjust the crop frame first'); return; }
    setBusy('Applying crop…');
    try {
      const sw = natW(src);
      const sh = natH(src);
      const rot = cropRotation;
      const rad = (rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const bboxW = Math.abs(cos * sw) + Math.abs(sin * sh);
      const bboxH = Math.abs(sin * sw) + Math.abs(cos * sh);
      const outW = Math.max(1, Math.round(area.width));
      const outH = Math.max(1, Math.round(area.height));

      const canvas = createCanvas(outW, outH);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(-area.x, -area.y);
      ctx.translate(bboxW / 2, bboxH / 2);
      ctx.rotate(rad);
      ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not encode crop');
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);
      const newImg = await loadImage(url);
      imagesRef.current.push(newImg);

      // Rigidly move every layer into the new cropped / rotated frame
      const mapPt = (x, y) => {
        const dx = x - sw / 2;
        const dy = y - sh / 2;
        return { x: bboxW / 2 + dx * cos - dy * sin - area.x, y: bboxH / 2 + dx * sin + dy * cos - area.y };
      };
      const objects = d.objects.map((o) => {
        if (o.isBackground) return { ...o, x: 0, y: 0, width: outW, height: outH };
        if (o.type === 'drawing') {
          const pts = [];
          for (let i = 0; i < o.points.length; i += 2) {
            const p = mapPt(o.points[i] + (o.x || 0), o.points[i + 1] + (o.y || 0));
            pts.push(p.x, p.y);
          }
          return { ...o, points: pts, x: 0, y: 0 };
        }
        const p = mapPt(o.x || 0, o.y || 0);
        return { ...o, x: p.x, y: p.y, rotation: (o.rotation || 0) + rot };
      });

      dispatchDoc({ type: 'APPLY_CROP', payload: { newImage: newImg, objects, width: outW, height: outH } });
      setCropRotation(0);
      setTool('select');
      toast.success('Crop applied');
    } catch (err) {
      console.error(err);
      toast.error('Crop failed');
    } finally {
      setBusy(null);
    }
  }, [cropRotation, dispatchDoc]);

  const autoEnhance = useCallback(() => {
    const d = docRef.current;
    if (!d.originalImage) return;
    try {
      const values = analyzeForAutoEnhance(d.originalImage);
      const same = Object.keys(values).every((k) => values[k] === d.adjustments[k]);
      if (same || (values.brightness === 0 && values.contrast === 0 && values.saturation === 0)) {
        toast.info('This photo is already well balanced');
        return;
      }
      dispatchDoc({ type: 'SET_ADJUSTMENTS', payload: { values }, meta: { label: 'Auto enhance' } });
      toast.success('Auto-enhance applied');
    } catch {
      toast.error('Auto-enhance failed');
    }
  }, [dispatchDoc]);

  /* ── export / save ─────────────────────────────────────────────────────── */
  const exportImage = useCallback(async (opts = {}) => {
    const d = docRef.current;
    if (!d.originalImage) throw new Error('No image');
    const W = d.imageDimensions.width;
    const H = d.imageDimensions.height;
    let w = Math.round(opts.width || W);
    let h = Math.round(opts.height || H);
    const limit = Math.min(1, MAX_EXPORT_SIDE / Math.max(w, h), Math.sqrt(MAX_EXPORT_AREA / (w * h)));
    if (limit < 1) { w = Math.max(1, Math.floor(w * limit)); h = Math.max(1, Math.floor(h * limit)); toast.info(`Size limited to ${w}×${h} for this device`); }

    const format = opts.format || 'png';
    const mime = MIME[format] || MIME.png;
    const quality = clamp(opts.quality ?? 0.92, 0.1, 1);
    const fit = opts.fit || 'contain';
    let bg = opts.background || 'auto';
    if (bg === 'auto') bg = format === 'png' || format === 'webp' ? 'transparent' : '#FFFFFF';
    if (bg === 'transparent' && format === 'jpeg') bg = '#FFFFFF';

    const fonts = new Set(d.objects.filter((o) => o.type === 'text' && o.visible !== false).map((o) => o.fontFamily || 'Inter'));
    await Promise.all([...fonts].map((f) => (document.fonts?.load ? document.fonts.load(`16px "${f}"`).catch(() => {}) : null)));

    const fullRes = renderProcessed(d.originalImage, d.adjustments, d.filter, d.filterIntensity, W, H);
    const stage = new Konva.Stage({ container: document.createElement('div'), width: w, height: h });
    try {
      const layer = new Konva.Layer();
      stage.add(layer);
      if (bg !== 'transparent') layer.add(new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: bg, listening: false }));
      const s = fit === 'cover' ? Math.max(w / W, h / H) : Math.min(w / W, h / H);
      const group = new Konva.Group({
        x: (w - W * s) / 2, y: (h - H * s) / 2, scaleX: s, scaleY: s,
        clipX: 0, clipY: 0, clipWidth: W, clipHeight: H,
      });
      group.add(new Konva.Image({ image: fullRes, x: 0, y: 0, width: W, height: H }));
      d.objects.filter((o) => !o.isBackground && o.visible !== false).forEach((o) => {
        const node = buildExportNode(o, imageCacheRef.current);
        if (node) group.add(node);
      });
      layer.add(group);
      const canvas = stage.toCanvas({ pixelRatio: 1 });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
      if (!blob) throw new Error('Encoding failed');
      let outFormat = format;
      if (blob.type && blob.type !== mime) {
        outFormat = Object.keys(MIME).find((k) => MIME[k] === blob.type) || 'png';
        toast.info(`${format.toUpperCase()} isn't supported here – saved as ${outFormat.toUpperCase()}`);
      }
      return { blob, width: w, height: h, format: outFormat };
    } finally {
      stage.destroy();
    }
  }, []);

  const fileBase = useMemo(() => {
    const n = (media?.file && media.file.name) || media?.name || 'arvdoul-edit';
    return String(n).replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 40) || 'arvdoul-edit';
  }, [media]);

  const saveToPost = useCallback(async (opts) => {
    const out = await exportImage(opts);
    const url = URL.createObjectURL(out.blob);
    objectUrlsRef.current.push(url);
    const file = new File([out.blob], `${fileBase}-edited.${EXT[out.format]}`, { type: out.blob.type });
    onSave?.({ blob: out.blob, url, file, edited: true, width: out.width, height: out.height, format: out.format });
    toast.success(`Saved ${out.format.toUpperCase()} ${out.width}×${out.height}`);
    return out;
  }, [exportImage, onSave, fileBase]);

  const downloadExport = useCallback(async (opts) => {
    const out = await exportImage(opts);
    const url = URL.createObjectURL(out.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBase}-edited.${EXT[out.format]}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast.success(`Downloaded ${out.format.toUpperCase()} ${out.width}×${out.height}`);
    return out;
  }, [exportImage, fileBase]);

  const handleExportAction = useCallback(async (mode, opts) => {
    if (busy) return;
    setBusy('Exporting…');
    try {
      if (mode === 'download') await downloadExport(opts);
      else await saveToPost(opts);
      setShowExport(false);
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    } finally {
      setBusy(null);
    }
  }, [busy, downloadExport, saveToPost]);

  const handleSave = useCallback(async () => {
    if (busy) return false;
    const d = docRef.current;
    setBusy('Saving…');
    try {
      await saveToPost({
        format: defaultFormat, quality: 0.95, width: d.imageDimensions.width, height: d.imageDimensions.height, fit: 'contain',
      });
      onClose?.();
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Save failed');
      return false;
    } finally {
      setBusy(null);
    }
  }, [busy, saveToPost, defaultFormat, onClose]);

  const requestClose = useCallback(() => {
    if (docRef.current.history.past.length > 0) setConfirmClose(true);
    else onClose?.();
  }, [onClose]);

  useImperativeHandle(ref, () => ({
    save: handleSave,
    undo,
    redo,
    exportImage,
    isDirty: () => docRef.current.history.past.length > 0,
  }), [handleSave, undo, redo, exportImage]);

  /* ── pointer / stage handlers ──────────────────────────────────────────── */
  const getWorldPoint = useCallback(() => {
    const stage = stageRef.current;
    const group = worldGroupRef.current;
    const p = stage?.getPointerPosition();
    if (!p || !group) return null;
    return group.getAbsoluteTransform().copy().invert().point(p);
  }, []);

  const cancelStroke = useCallback(() => {
    isDrawingRef.current = false;
    drawingPointsRef.current = [];
    const line = drawingLineRef.current;
    if (line) { line.points(EMPTY_POINTS); line.getLayer()?.batchDraw(); }
  }, []);

  const brushScale = Math.max(1, Math.min(bgW, bgH) / 1080);
  const strokeSize = drawBrushSize * brushScale * (brushKind === 'highlighter' ? 3 : 1);
  const strokeOpacity = brushKind === 'highlighter' ? 0.4 : 1;

  const onStageDown = useCallback((e) => {
    if (pointersRef.current.size > 1) return;
    if (e.evt && e.evt.button > 0) return;
    const stage = e.target.getStage();
    if (e.target === stage && selectMode && docRef.current.selectedId) selectObject(null);
    if (tool !== 'draw' || panActive) return;
    const p = getWorldPoint();
    if (!p) return;
    isDrawingRef.current = true;
    drawingPointsRef.current = [p.x, p.y];
    const line = drawingLineRef.current;
    if (line) { line.points([p.x, p.y]); line.getLayer()?.batchDraw(); }
  }, [selectMode, tool, panActive, getWorldPoint, selectObject]);

  const onStageMove = useCallback(() => {
    if (!isDrawingRef.current || tool !== 'draw') return;
    if (pointersRef.current.size > 1) { cancelStroke(); return; }
    const p = getWorldPoint();
    if (!p) return;
    const pts = drawingPointsRef.current;
    const lx = pts[pts.length - 2];
    const ly = pts[pts.length - 1];
    if (Math.hypot(p.x - lx, p.y - ly) < 1.2 / Math.max(effScale, 0.0001)) return;
    pts.push(p.x, p.y);
    const line = drawingLineRef.current;
    if (line) { line.points(pts); line.getLayer()?.batchDraw(); }
  }, [tool, getWorldPoint, effScale, cancelStroke]);

  const onStageUp = useCallback(() => {
    if (!isDrawingRef.current || tool !== 'draw') return;
    const pts = drawingPointsRef.current;
    if (pts.length === 2) pts.push(pts[0] + 0.01, pts[1]); // a tap draws a dot
    if (pts.length >= 4) {
      addObj('drawing', {
        name: brushKind === 'highlighter' ? 'Highlight' : 'Drawing', points: [...pts], color: drawColor, brushSize: strokeSize, opacity: strokeOpacity, x: 0, y: 0,
      }, 'Draw');
    }
    cancelStroke();
  }, [tool, addObj, brushKind, drawColor, strokeSize, strokeOpacity, cancelStroke]);

  const onStageClick = useCallback((e) => {
    if (e.target !== e.target.getStage()) return;
    if (tool !== 'text' || panActive) return;
    const now = Date.now();
    if (now - lastAddRef.current < 400) return; // click + tap can both fire on touch devices
    lastAddRef.current = now;
    const p = getWorldPoint();
    if (p) addTextAt(clamp(p.x, 0, bgW), clamp(p.y, 0, bgH));
  }, [tool, panActive, getWorldPoint, addTextAt, bgW, bgH]);

  // Workspace pointer layer: pinch-zoom, two-finger pan, hand-tool / space pan
  const onWsPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    const el = workspaceRef.current;
    if (!el) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = el.getBoundingClientRect();
    const v = viewRef.current;
    if (pointersRef.current.size === 2) {
      cancelStroke();
      panRef.current = null;
      const [a, b] = [...pointersRef.current.values()];
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      const eff = v.baseScale * v.zoom;
      const vx = (v.midW - v.bgW * eff) / 2 + v.pan.x;
      const vy = (v.midH - v.bgH * eff) / 2 + v.pan.y;
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: v.zoom, wx: (mx - vx) / eff, wy: (my - vy) / eff };
    } else if (pointersRef.current.size === 1 && (panActive || e.button === 1)) {
      panRef.current = { x: e.clientX, y: e.clientY, panX: v.pan.x, panY: v.pan.y };
    }
  };

  const onWsPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const el = workspaceRef.current;
    if (!el) return;
    const v = viewRef.current;
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const rect = el.getBoundingClientRect();
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      const st = pinchRef.current;
      const z = clamp(st.zoom * (dist / st.dist), MIN_ZOOM, MAX_ZOOM);
      const newEff = v.baseScale * z;
      const nextPan = {
        x: mx - st.wx * newEff - (v.midW - v.bgW * newEff) / 2,
        y: my - st.wy * newEff - (v.midH - v.bgH * newEff) / 2,
      };
      viewRef.current = { ...v, zoom: z, pan: nextPan };
      setZoom(z);
      setPan(nextPan);
    } else if (panRef.current) {
      if (e.buttons === 0 && e.pointerType === 'mouse') { panRef.current = null; return; }
      const st = panRef.current;
      const nextPan = { x: st.panX + e.clientX - st.x, y: st.panY + e.clientY - st.y };
      viewRef.current = { ...v, pan: nextPan };
      setPan(nextPan);
    }
  };

  const onWsPointerUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) panRef.current = null;
  };

  /* ── node events (shared by every layer type) ──────────────────────────── */
  const selectFromNode = (obj) => {
    if (!(selectMode || tool === 'text')) return;
    if (panActive) return;
    if (docRef.current.selectedId !== obj.id) selectObject(obj.id);
  };

  const handleDragMove = (e) => {
    const node = e.target;
    const group = worldGroupRef.current;
    if (!group) return;
    const rect = node.getClientRect({ relativeTo: group });
    const thr = 8 / Math.max(viewRef.current.baseScale * viewRef.current.zoom, 0.0001);
    const W = viewRef.current.bgW;
    const H = viewRef.current.bgH;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    let vx = null;
    let hy = null;
    let dx = null;
    let dy = null;
    [[cx, W / 2], [rect.x, 0], [rect.x + rect.width, W]].forEach(([from, to]) => {
      const dlt = to - from;
      if (Math.abs(dlt) < thr && (dx === null || Math.abs(dlt) < Math.abs(dx))) { dx = dlt; vx = to; }
    });
    [[cy, H / 2], [rect.y, 0], [rect.y + rect.height, H]].forEach(([from, to]) => {
      const dlt = to - from;
      if (Math.abs(dlt) < thr && (dy === null || Math.abs(dlt) < Math.abs(dy))) { dy = dlt; hy = to; }
    });
    if (dx !== null) node.x(node.x() + dx);
    if (dy !== null) node.y(node.y() + dy);
    setSnap((p) => (p.vx === vx && p.hy === hy ? p : { vx, hy }));
  };

  const bakeDrawing = (obj, node) => {
    const m = node.getTransform();
    const pts = [];
    for (let i = 0; i < obj.points.length; i += 2) {
      const p = m.point({ x: obj.points[i], y: obj.points[i + 1] });
      pts.push(p.x, p.y);
    }
    const s = (Math.abs(node.scaleX()) + Math.abs(node.scaleY())) / 2;
    node.position({ x: 0, y: 0 });
    node.scale({ x: 1, y: 1 });
    node.rotation(0);
    return { points: pts, brushSize: Math.max(1, (obj.brushSize || 5) * s), x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  };

  const finishDrag = (obj, e) => {
    setSnap({ vx: null, hy: null });
    const node = e.target;
    if (obj.type === 'drawing') updObj(obj.id, bakeDrawing(obj, node), { label: 'Move' });
    else updObj(obj.id, { x: node.x(), y: node.y() }, { label: 'Move' });
  };

  const finishTransform = (obj, e) => {
    const node = e.target;
    if (obj.type === 'drawing') { updObj(obj.id, bakeDrawing(obj, node), { label: 'Transform' }); return; }
    const sx = node.scaleX();
    const sy = node.scaleY();
    const patch = { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: 1, scaleY: 1 };
    if (obj.type === 'text') {
      patch.width = Math.max(24, node.width() * sx);
      patch.fontSize = Math.max(6, Math.round((obj.fontSize || 48) * sy));
    } else if (obj.type === 'image') {
      patch.width = Math.max(8, node.width() * sx);
      patch.height = Math.max(8, node.height() * sy);
    } else if (obj.type === 'shape') {
      let nw = node.width() * sx;
      let nh = node.height() * sy;
      if (['circle', 'star', 'triangle'].includes(obj.shapeType)) {
        const s = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
        nw = node.width() * s;
        nh = nw;
      }
      patch.width = Math.max(8, nw);
      patch.height = Math.max(8, nh);
    }
    node.scaleX(1);
    node.scaleY(1);
    updObj(obj.id, patch, { label: 'Transform' });
  };

  /* ── keyboard ──────────────────────────────────────────────────────────── */
  latest.current = {
    doc, tool, editingId, cropMode, showExport, confirmClose, busy, handleSave, undo, redo, delObj, dupObj, updObj,
    openTool, applyCrop, zoomBy, fitView, actualSize, commitEdit, requestClose, selectObject, reorder,
  };

  useEffect(() => {
    const typing = (t) => !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
    const onKeyDown = (e) => {
      const L = latest.current;
      if (typing(e.target)) return;
      if (L.showExport || L.confirmClose) return;
      const cmd = e.ctrlKey || e.metaKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (e.code === 'Space' && !cmd) { e.preventDefault(); setSpaceDown(true); return; }
      if (cmd && key === 'z') { e.preventDefault(); if (e.shiftKey) L.redo(); else L.undo(); return; }
      if (cmd && key === 'y') { e.preventDefault(); L.redo(); return; }
      if (cmd && key === 's') { e.preventDefault(); L.handleSave(); return; }
      if (cmd && key === 'd') { e.preventDefault(); if (L.doc.selectedId) L.dupObj(L.doc.selectedId); return; }
      if (cmd && key === 'e') { e.preventDefault(); setShowExport(true); return; }
      if (cmd) return;

      const sel = L.doc.objects.find((o) => o.id === L.doc.selectedId);
      if (key === 'Delete' || key === 'Backspace') {
        if (sel && !sel.isBackground) { e.preventDefault(); L.delObj(sel.id); }
        return;
      }
      if (key === 'Escape') {
        if (L.cropMode) L.openTool('crop');
        else if (L.tool !== 'select') L.openTool(L.tool);
        else if (L.doc.selectedId) L.selectObject(null);
        else L.requestClose();
        return;
      }
      if (key === 'Enter' && L.cropMode) { e.preventDefault(); L.applyCrop(); return; }
      if (key.startsWith('Arrow') && sel && !sel.isBackground && !sel.locked && L.tool !== 'crop') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        if (sel.type === 'drawing') {
          L.updObj(sel.id, { points: sel.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) }, { label: 'Nudge', coalesce: 'nudge' });
        } else {
          L.updObj(sel.id, { x: (sel.x || 0) + dx, y: (sel.y || 0) + dy }, { label: 'Nudge', coalesce: 'nudge' });
        }
        return;
      }
      if (key === '+' || key === '=') { L.zoomBy(1.25); return; }
      if (key === '-' || key === '_') { L.zoomBy(0.8); return; }
      if (key === '0') { L.fitView(); return; }
      if (key === '1') { L.actualSize(); return; }
      if (key === 'v') L.openTool('select');
      else if (key === 't' && L.tool !== 'text') L.openTool('text');
      else if (key === 'b' && L.tool !== 'draw') L.openTool('draw');
      else if (key === 'c' && L.tool !== 'crop') L.openTool('crop');
      else if (key === 'h') setHandMode((p) => !p);
    };
    const onKeyUp = (e) => { if (e.code === 'Space') setSpaceDown(false); };
    const onBlur = () => { setSpaceDown(false); setShowOriginal(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  /* ── loading / error states (all hooks are above this line) ───────────── */
  if (!doc.originalImage) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="ie-root" style={rootVars} data-theme={isDark ? 'dark' : 'light'} role="dialog" aria-modal="true" aria-label="Image editor">
          <style>{STYLES}</style>
          <div className="ie-fx" aria-hidden="true"><i /><i /></div>
          <div className="ie-center">
            {loadError ? (
              <>
                <div className="ie-errmark"><IAlert size={26} /></div>
                <h3>Unable to load image</h3>
                <p>The image file or preview could not be opened in the editor.</p>
                <div className="ie-row">
                  <button type="button" className="ie-btn-sec" onClick={onClose}>Go back</button>
                  <button type="button" className="ie-btn" onClick={() => { setLoadError(false); setReloadToken((t) => t + 1); }}>Try again</button>
                </div>
              </>
            ) : (
              <>
                <LoadingSpinner size={50} />
                <p>Opening Image Studio…</p>
                <button type="button" className="ie-btn-sec" onClick={onClose}>Cancel</button>
              </>
            )}
          </div>
        </div>
      </MotionConfig>
    );
  }

  /* ── render helpers ────────────────────────────────────────────────────── */
  const bgImage = showOriginal ? doc.originalImage : (processed || doc.originalImage);
  const objectsToDraw = doc.objects.filter((o) => !o.isBackground);
  const ready = containerSize.width > 0 && containerSize.height > 0;
  const percent = Math.round(effScale * 100);
  const cursor = panActive ? (pointersRef.current.size ? 'grabbing' : 'grab') : tool === 'draw' ? 'draw' : tool === 'text' ? 'text' : 'default';

  const renderObj = (obj) => {
    const c = commonAttrs(obj);
    const common = {
      ...c,
      name: 'ie-obj',
      visible: c.visible && !showOriginal,
      draggable: selectMode && !obj.locked && !showOriginal,
      onMouseDown: () => selectFromNode(obj),
      onTouchStart: () => selectFromNode(obj),
      onDragMove: handleDragMove,
      onDragEnd: (e) => finishDrag(obj, e),
      onTransformEnd: (e) => finishTransform(obj, e),
    };
    switch (obj.type) {
      case 'image': {
        const img = imageCache[obj.id];
        return img ? <KonvaImage key={obj.id} {...common} image={img} width={obj.width} height={obj.height} /> : null;
      }
      case 'text':
        return (
          <KonvaText
            key={obj.id}
            {...common}
            {...textAttrs(obj)}
            visible={common.visible && editingId !== obj.id}
            onDblClick={() => startEdit(obj.id)}
            onDblTap={() => startEdit(obj.id)}
          />
        );
      case 'shape': {
        const { kind, attrs } = shapeGeometry(obj);
        const Comp = SHAPE_COMPONENTS[kind];
        return <Comp key={obj.id} {...common} {...attrs} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} />;
      }
      case 'drawing':
        return <Line key={obj.id} {...common} {...drawingAttrs(obj)} />;
      default:
        return null;
    }
  };

  const selectedText = selObj && selObj.type === 'text' ? selObj : undefined;
  const transformerAnchors = selObj && selObj.type === 'text'
    ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']
    : undefined;

  const editingObj = editingId ? doc.objects.find((o) => o.id === editingId) : null;

  const layerIcon = (o) => {
    if (o.type === 'image') return IImagePlus;
    if (o.type === 'text') return o.name === 'Sticker' ? ISmile : IType;
    if (o.type === 'shape') return IShapes;
    if (o.type === 'drawing') return IPencil;
    return ILayers;
  };

  /* ── panels ────────────────────────────────────────────────────────────── */
  const renderPanel = () => {
    const close = () => { if (tool === 'crop') setTool('select'); else setTool('select'); };
    const adj = doc.adjustments;
    const setAdj = (key) => (value) => dispatchDoc({ type: 'SET_ADJUSTMENT', payload: { key, value } });

    switch (tool) {
      case 'adjust':
        return (
          <PanelShell
            title={PANEL_TITLES.adjust}
            onClose={close}
            actions={(
              <button type="button" className="ie-iconbtn" onClick={() => dispatchDoc({ type: 'RESET_LOOK' })} aria-label="Reset all adjustments and filter" title="Reset look">
                <IRotCCW size={17} />
              </button>
            )}
          >
            <div className="ie-stack">
              <button type="button" className="ie-btn" onClick={autoEnhance} style={{ width: '100%' }}>
                <ISparkles size={17} /> Auto enhance
              </button>
              <div className="ie-tool-host">
                <AdjustTool
                  brightness={adj.brightness}
                  setBrightness={setAdj('brightness')}
                  contrast={adj.contrast}
                  setContrast={setAdj('contrast')}
                  saturation={adj.saturation}
                  setSaturation={setAdj('saturation')}
                  resetAdjustments={() => dispatchDoc({ type: 'RESET_ADJUSTMENTS' })}
                  pushUndo={() => {}}
                />
              </div>
              <div className="ie-divider" />
              <span className="ie-label" style={{ margin: 0 }}>Fine tune</span>
              <Range id="ie-adj-temp" label="Temperature" value={adj.temperature} min={-100} max={100} onChange={setAdj('temperature')} />
              <Range id="ie-adj-hue" label="Hue" value={adj.hue} min={-180} max={180} onChange={setAdj('hue')} format={(v) => `${v}°`} />
              <Range id="ie-adj-vig" label="Vignette" value={adj.vignette} min={0} max={100} onChange={setAdj('vignette')} />
              <Range id="ie-adj-blur" label="Blur" value={adj.blur} min={0} max={20} step={0.5} onChange={setAdj('blur')} />
            </div>
          </PanelShell>
        );

      case 'filter':
        return (
          <PanelShell title={PANEL_TITLES.filter} onClose={close}>
            <div className="ie-stack">
              <div>
                <span className="ie-label">Arvdoul looks</span>
                <div className="ie-looks" role="group" aria-label="Looks">
                  {LOOKS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className="ie-look"
                      aria-pressed={doc.filter === l.id}
                      onClick={() => dispatchDoc({ type: 'SET_FILTER', payload: { filter: l.id } })}
                    >
                      <i style={{ background: l.swatch }} />
                      {l.label}
                    </button>
                  ))}
                </div>
                <Range
                  id="ie-look-strength"
                  label="Strength"
                  value={doc.filterIntensity}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={doc.filter === 'none'}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => dispatchDoc({ type: 'SET_FILTER_INTENSITY', payload: { intensity: v } })}
                />
              </div>
              <div className="ie-divider" />
              <div className="ie-tool-host">
                <FilterTool
                  filter={doc.filter}
                  setFilter={(v) => dispatchDoc({ type: 'SET_FILTER', payload: { filter: v } })}
                  filterIntensity={doc.filterIntensity}
                  setFilterIntensity={(v) => dispatchDoc({ type: 'SET_FILTER_INTENSITY', payload: { intensity: v } })}
                  pushUndo={() => {}}
                />
              </div>
            </div>
          </PanelShell>
        );

      case 'text':
        return (
          <PanelShell title={PANEL_TITLES.text} onClose={close}>
            <div className="ie-stack">
              <button
                type="button"
                className="ie-btn"
                style={{ width: '100%' }}
                onClick={() => { const c = viewCenterWorld(); addTextAt(c.x, c.y); }}
              >
                <IPlus size={17} /> Add text
              </button>
              {!selectedText && <p className="ie-hint">Tap the photo to place text, or double-tap any text to edit it.</p>}
              <FontPicker
                current={selectedText?.fontFamily || 'Inter'}
                onSelect={(font) => { if (selectedText) updObj(selectedText.id, { fontFamily: font }, { label: 'Font' }); }}
              />
              {selectedText && (
                <>
                  <ColorField label="Colour" value={selectedText.fill} onChange={(v) => updObj(selectedText.id, { fill: v }, { label: 'Text colour', coalesce: 'fill' })} />
                  <div>
                    <span className="ie-label">Align</span>
                    <div className="ie-seg" role="group" aria-label="Text alignment">
                      {[['left', IAlignL], ['center', IAlignC], ['right', IAlignR]].map(([a, Ico]) => (
                        <button key={a} type="button" aria-label={`Align ${a}`} aria-pressed={(selectedText.align || 'left') === a} onClick={() => updObj(selectedText.id, { align: a }, { label: 'Align text' })}>
                          <Ico size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="ie-divider" />
              <div className="ie-tool-host">
                <TextTool
                  selectedText={selectedText}
                  updateSelectedText={(updates) => { if (selectedText) updObj(selectedText.id, updates, { label: 'Edit text', coalesce: true }); }}
                  handleDeleteText={() => { if (selectedText) delObj(selectedText.id); }}
                  handleQuickAddText={() => { const c = viewCenterWorld(); addTextAt(c.x, c.y); }}
                  imageElement={doc.originalImage}
                  pushUndo={() => {}}
                />
              </div>
            </div>
          </PanelShell>
        );

      case 'draw':
        return (
          <PanelShell title={PANEL_TITLES.draw} onClose={close}>
            <div className="ie-stack">
              <div>
                <span className="ie-label">Brush</span>
                <div className="ie-seg" role="group" aria-label="Brush type">
                  <button type="button" aria-pressed={brushKind === 'pen'} onClick={() => setBrushKind('pen')}><IPencil size={15} /> Pen</button>
                  <button type="button" aria-pressed={brushKind === 'highlighter'} onClick={() => setBrushKind('highlighter')}><IWand size={15} /> Highlighter</button>
                </div>
              </div>
              <div className="ie-tool-host">
                <DrawingTool
                  color={drawColor}
                  brushSize={drawBrushSize}
                  onColorChange={setDrawColor}
                  onBrushSizeChange={setDrawBrushSize}
                  onUndo={undo}
                  onClear={() => dispatchDoc({ type: 'CLEAR_DRAWINGS' })}
                  theme={theme}
                />
              </div>
              <p className="ie-hint">Pinch with two fingers to zoom while you draw. Strokes become layers you can move or resize.</p>
            </div>
          </PanelShell>
        );

      case 'shape':
        return (
          <PanelShell title={PANEL_TITLES.shape} onClose={close}>
            <div className="ie-stack">
              <div className="ie-grid ie-grid-shapes">
                {SHAPES.map((s) => (
                  <button key={s.id} type="button" className="ie-tile" onClick={() => addShape(s.id)}>
                    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill={shapeStyle.fill} stroke={shapeStyle.stroke} strokeWidth={shapeStyle.strokeWidth > 0 ? 1.5 : 0}>
                      {s.id === 'rect' && <rect x="3" y="5" width="22" height="18" rx="2" />}
                      {s.id === 'circle' && <circle cx="14" cy="14" r="11" />}
                      {s.id === 'ellipse' && <ellipse cx="14" cy="14" rx="12" ry="8" />}
                      {s.id === 'triangle' && <polygon points="14,3 25,24 3,24" />}
                      {s.id === 'star' && <polygon points="14,2 17.6,10 26,11 19.7,16.8 21.4,25.5 14,21 6.6,25.5 8.3,16.8 2,11 10.4,10" />}
                    </svg>
                    {s.label}
                  </button>
                ))}
              </div>
              <ColorField label="Fill" value={shapeStyle.fill} allowNone onChange={(v) => setShapeStyle((p) => ({ ...p, fill: v }))} />
              <ColorField label="Outline" value={shapeStyle.stroke} onChange={(v) => setShapeStyle((p) => ({ ...p, stroke: v }))} />
              <Range
                id="ie-shape-stroke"
                label="Outline width"
                value={shapeStyle.strokeWidth}
                min={0}
                max={Math.max(8, Math.round(Math.min(bgW, bgH) * 0.02))}
                onChange={(v) => setShapeStyle((p) => ({ ...p, strokeWidth: v }))}
              />
              <p className="ie-hint">Pick a style, then tap a shape to place it. Select a placed shape to edit it in Properties.</p>
            </div>
          </PanelShell>
        );

      case 'sticker':
        return (
          <PanelShell title={PANEL_TITLES.sticker} onClose={close}>
            <div className="ie-stack">
              <div className="ie-chips" role="group" aria-label="Sticker sets">
                {Object.keys(STICKER_SETS).map((k) => (
                  <button key={k} type="button" className="ie-chip" aria-pressed={stickerSet === k} onClick={() => setStickerSet(k)}>{k}</button>
                ))}
              </div>
              <div className="ie-grid ie-grid-emoji">
                {STICKER_SETS[stickerSet].map((emo) => (
                  <button key={emo} type="button" className="ie-emoji" aria-label={`Add ${emo}`} onClick={() => addSticker(emo)}>{emo}</button>
                ))}
              </div>
            </div>
          </PanelShell>
        );

      case 'photo':
        return (
          <PanelShell title={PANEL_TITLES.photo} onClose={close}>
            <div className="ie-stack">
              <button type="button" className="ie-btn" style={{ width: '100%' }} onClick={() => fileInputRef.current?.click()}>
                <IImagePlus size={17} /> Choose from device
              </button>
              {additionalMedia.length > 0 ? (
                <div>
                  <span className="ie-label">From your selection</span>
                  <div className="ie-grid ie-grid-media">
                    {additionalMedia.map((m, idx) => (
                      <button
                        key={m.id || m.url || m.preview || idx}
                        type="button"
                        className="ie-thumb"
                        aria-label={`Add photo ${idx + 2}`}
                        onClick={async () => {
                          const ok = await addImageFromSrc(m.file || m.url || m.preview, `Photo ${idx + 2}`);
                          if (ok) toast.success('Photo added');
                        }}
                      >
                        <img src={m.preview || m.url} alt="" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="ie-hint">Add extra photos as layers you can move, resize and rotate.</p>
              )}
            </div>
          </PanelShell>
        );

      case 'layers': {
        const layers = [...doc.objects].reverse();
        return (
          <PanelShell title={PANEL_TITLES.layers} onClose={close}>
            <div className="ie-stack" style={{ gap: 8 }}>
              {layers.map((l) => {
                const Ico = layerIcon(l);
                const locked = l.isBackground || l.locked;
                return (
                  <div
                    key={l.id}
                    className="ie-layer"
                    data-selected={doc.selectedId === l.id}
                    data-hidden={l.visible === false}
                    onClick={() => { if (!l.isBackground) selectObject(l.id); }}
                  >
                    <span className="ie-layer-ico"><Ico size={16} /></span>
                    <span className="ie-layer-name">{l.name || l.type}</span>
                    {!l.isBackground ? (
                      <span className="ie-layer-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="ie-iconbtn" aria-label={l.visible === false ? 'Show layer' : 'Hide layer'} onClick={() => toggleVis(l.id)}>
                          {l.visible === false ? <IEyeOff size={15} /> : <IEye size={15} />}
                        </button>
                        <button type="button" className="ie-iconbtn" aria-label={l.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => toggleLock(l.id)}>
                          {l.locked ? <ILock size={15} /> : <IUnlock size={15} />}
                        </button>
                        <button type="button" className="ie-iconbtn" aria-label="Bring forward" onClick={() => reorder(l.id, 'up')}><IUp size={15} /></button>
                        <button type="button" className="ie-iconbtn" aria-label="Send backward" onClick={() => reorder(l.id, 'down')}><IDown size={15} /></button>
                        <button type="button" className="ie-iconbtn" aria-label="Duplicate layer" onClick={() => dupObj(l.id)}><ICopy size={15} /></button>
                        <button type="button" className="ie-iconbtn" data-danger="true" aria-label="Delete layer" onClick={() => delObj(l.id)} disabled={locked}><ITrash size={15} /></button>
                      </span>
                    ) : (
                      <ILock size={14} style={{ color: 'var(--text-3)', marginRight: 8 }} aria-label="Locked" />
                    )}
                  </div>
                );
              })}
              {layers.length === 1 && <p className="ie-empty">No extra layers yet. Add text, shapes, stickers, drawings or photos.</p>}
            </div>
          </PanelShell>
        );
      }

      case 'history': {
        const { past, present, future } = doc.history;
        const timeline = [...past, present, ...future].filter(Boolean);
        return (
          <PanelShell
            title={PANEL_TITLES.history}
            onClose={close}
            actions={(
              <>
                <button type="button" className="ie-iconbtn" onClick={undo} disabled={past.length === 0} aria-label="Undo"><IUndo size={17} /></button>
                <button type="button" className="ie-iconbtn" onClick={redo} disabled={future.length === 0} aria-label="Redo"><IRedo size={17} /></button>
              </>
            )}
          >
            <div className="ie-stack" style={{ gap: 6 }}>
              {timeline.map((entry, i) => (
                <button
                  key={`${i}-${entry.time}`}
                  type="button"
                  className="ie-hist-item"
                  aria-current={i === past.length}
                  data-future={i > past.length}
                  onClick={() => dispatchDoc({ type: 'JUMP_HISTORY', payload: { index: i } })}
                >
                  <b>{i}</b>
                  <span>{entry.label}</span>
                </button>
              ))}
            </div>
          </PanelShell>
        );
      }

      case 'props': {
        if (!selObj || selObj.isBackground) {
          return (
            <PanelShell title={PANEL_TITLES.props} onClose={close}>
              <p className="ie-empty">Select a layer on the photo to edit its properties.</p>
            </PanelShell>
          );
        }
        const o = selObj;
        const isShape = o.type === 'shape';
        const isText = o.type === 'text';
        const isDrawing = o.type === 'drawing';
        const maxCorner = Math.round(Math.min(o.width || 100, o.height || 100) / 2);
        return (
          <PanelShell title={PANEL_TITLES.props} onClose={close}>
            <div className="ie-stack">
              <div className="ie-row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 14 }}>{o.name || o.type}</strong>
                <div className="ie-row" style={{ gap: 4 }}>
                  <button type="button" className="ie-iconbtn" onClick={() => toggleVis(o.id)} aria-label={o.visible === false ? 'Show layer' : 'Hide layer'}>{o.visible === false ? <IEyeOff size={16} /> : <IEye size={16} />}</button>
                  <button type="button" className="ie-iconbtn" onClick={() => toggleLock(o.id)} aria-label={o.locked ? 'Unlock layer' : 'Lock layer'}>{o.locked ? <ILock size={16} /> : <IUnlock size={16} />}</button>
                </div>
              </div>
              <Range
                id="ie-prop-opacity"
                label="Opacity"
                value={Math.round((o.opacity ?? 1) * 100)}
                min={0}
                max={100}
                format={(v) => `${v}%`}
                onChange={(v) => updObj(o.id, { opacity: v / 100 }, { label: 'Opacity', coalesce: 'opacity' })}
              />
              {!isDrawing && (
                <Range
                  id="ie-prop-rot"
                  label="Rotation"
                  value={Math.round(o.rotation || 0)}
                  min={-180}
                  max={180}
                  format={(v) => `${v}°`}
                  onChange={(v) => updObj(o.id, { rotation: v }, { label: 'Rotate', coalesce: 'rotation' })}
                />
              )}
              {(isShape || isText) && (
                <ColorField
                  label={isText ? 'Text colour' : 'Fill'}
                  value={o.fill}
                  allowNone={isShape}
                  onChange={(v) => updObj(o.id, { fill: v }, { label: 'Fill', coalesce: 'fill' })}
                />
              )}
              {isDrawing && (
                <ColorField label="Stroke colour" value={o.color} onChange={(v) => updObj(o.id, { color: v }, { label: 'Stroke colour', coalesce: 'color' })} />
              )}
              {isShape && (
                <>
                  <ColorField label="Outline" value={o.stroke} onChange={(v) => updObj(o.id, { stroke: v }, { label: 'Outline', coalesce: 'stroke' })} />
                  <Range
                    id="ie-prop-sw"
                    label="Outline width"
                    value={Math.round(o.strokeWidth || 0)}
                    min={0}
                    max={Math.max(8, Math.round(Math.min(bgW, bgH) * 0.02))}
                    onChange={(v) => updObj(o.id, { strokeWidth: v }, { label: 'Outline width', coalesce: 'strokeWidth' })}
                  />
                  {o.shapeType === 'rect' && (
                    <Range
                      id="ie-prop-cr"
                      label="Corner radius"
                      value={Math.min(Math.round(o.cornerRadius || 0), maxCorner)}
                      min={0}
                      max={Math.max(1, maxCorner)}
                      onChange={(v) => updObj(o.id, { cornerRadius: v }, { label: 'Corner radius', coalesce: 'cornerRadius' })}
                    />
                  )}
                </>
              )}
              <div className="ie-divider" />
              <span className="ie-label" style={{ margin: 0 }}>Arrange</span>
              <div className="ie-chips">
                <button type="button" className="ie-chip" onClick={() => reorder(o.id, 'top')}>To front</button>
                <button type="button" className="ie-chip" onClick={() => reorder(o.id, 'up')}>Forward</button>
                <button type="button" className="ie-chip" onClick={() => reorder(o.id, 'down')}>Backward</button>
                <button type="button" className="ie-chip" onClick={() => reorder(o.id, 'bottom')}>To back</button>
              </div>
              <div className="ie-row">
                <button type="button" className="ie-btn-sec" onClick={() => dupObj(o.id)}><ICopy size={16} /> Duplicate</button>
                <button type="button" className="ie-btn-danger" onClick={() => delObj(o.id)}><ITrash size={16} /> Delete</button>
              </div>
            </div>
          </PanelShell>
        );
      }

      case 'crop':
        return (
          <PanelShell title={PANEL_TITLES.crop} onClose={close}>
            <div className="ie-stack">
              <div>
                <span className="ie-label">Rotate</span>
                <div className="ie-row">
                  <button type="button" className="ie-btn-sec" onClick={() => setCropRotation((r) => ((r - 90 + 540) % 360) - 180 + 180 === 360 ? 0 : ((r - 90) % 360))}>
                    <IRotCCW size={16} /> 90° left
                  </button>
                  <button type="button" className="ie-btn-sec" onClick={() => setCropRotation((r) => (r + 90) % 360)}>
                    <IRotCW size={16} /> 90° right
                  </button>
                </div>
              </div>
              <Range
                id="ie-crop-rot"
                label="Straighten"
                value={Math.max(-180, Math.min(180, cropRotation > 180 ? cropRotation - 360 : cropRotation))}
                min={-45}
                max={45}
                step={0.5}
                format={(v) => `${v}°`}
                onChange={(v) => setCropRotation(v)}
              />
              <div className="ie-tool-host">
                <CropTool
                  aspect={doc.crop.aspect}
                  setAspect={(aspect) => dispatchDoc({ type: 'SET_CROP_ASPECT', payload: { aspect } })}
                  zoom={doc.crop.zoom}
                  onZoomChange={(z) => dispatchDoc({ type: 'SET_CROP_ZOOM', payload: { zoom: z } })}
                  onCropChangeWithUndo={() => {}}
                  onCropComplete={handleCropComplete}
                  pushUndo={() => {}}
                  setCrop={(pos) => dispatchDoc({ type: 'SET_CROP', payload: { position: pos } })}
                  setZoom={(z) => dispatchDoc({ type: 'SET_CROP_ZOOM', payload: { zoom: z } })}
                  setCroppedAreaPixels={(p) => dispatchDoc({ type: 'SET_CROP_AREA_PIXELS', payload: { areaPixels: p } })}
                />
              </div>
              <div className="ie-row">
                <button type="button" className="ie-btn-sec" onClick={() => setTool('select')}>Cancel</button>
                <button type="button" className="ie-btn" onClick={applyCrop} disabled={!!busy}><ICheck size={16} /> Apply crop</button>
              </div>
            </div>
          </PanelShell>
        );

      default:
        return null;
    }
  };

  /* ── render ────────────────────────────────────────────────────────────── */
  const editorStyle = editingObj
    ? (() => {
      const sx = Math.abs(editingObj.scaleX ?? 1);
      const sy = Math.abs(editingObj.scaleY ?? 1);
      return {
        left: viewportX + (editingObj.x || 0) * effScale,
        top: viewportY + (editingObj.y || 0) * effScale,
        width: Math.max(40, (editingObj.width || 300) * sx * effScale),
        fontSize: (editingObj.fontSize || 48) * sy * effScale,
        fontFamily: `"${editingObj.fontFamily || 'Inter'}", sans-serif`,
        color: editingObj.fill || '#fff',
        lineHeight: editingObj.lineHeight || 1,
        textAlign: editingObj.align || 'left',
        fontWeight: /bold/i.test(editingObj.fontStyle || '') ? 700 : 400,
        fontStyle: /italic/i.test(editingObj.fontStyle || '') ? 'italic' : 'normal',
        transform: `rotate(${editingObj.rotation || 0}deg)`,
        transformOrigin: '0 0',
      };
    })()
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="ie-root" style={rootVars} data-theme={isDark ? 'dark' : 'light'} role="dialog" aria-modal="true" aria-label="Image editor">
        <style>{STYLES}</style>
        <div className="ie-fx" aria-hidden="true"><i /><i /></div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />

        {/* ── Top bar ── */}
        <header className="ie-top">
          <div className="ie-top-group">
            <button type="button" className="ie-iconbtn" onClick={requestClose} aria-label="Close editor"><IClose size={20} /></button>
            <div className="ie-titlewrap ie-hide-sm">
              <span className="ie-title">Image Studio</span>
              <span className="ie-sub">{bgW} × {bgH} · {((bgW * bgH) / 1e6).toFixed(1)} MP</span>
            </div>
          </div>

          <div className="ie-top-group">
            <button type="button" className="ie-iconbtn" onClick={undo} disabled={doc.history.past.length === 0} aria-label="Undo" title="Undo (Ctrl+Z)"><IUndo size={18} /></button>
            <button type="button" className="ie-iconbtn" onClick={redo} disabled={doc.history.future.length === 0} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><IRedo size={18} /></button>
          </div>

          <div className="ie-top-group">
            {hist && <span className="ie-hide-md"><Histogram data={hist} /></span>}
            {typeof toggleTheme === 'function' && (
              <button type="button" className="ie-iconbtn ie-hide-md" onClick={toggleTheme} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
                {isDark ? <ISun size={17} /> : <IMoon size={17} />}
              </button>
            )}
            <button type="button" className="ie-btn-sec" onClick={() => setShowExport(true)} disabled={!!busy} aria-label="Export options" title="Export (Ctrl+E)">
              <IDownload size={16} /><span className="ie-hide-sm">Export</span>
            </button>
            <button type="button" className="ie-btn" onClick={handleSave} disabled={!!busy} title="Done (Ctrl+S)">
              <ICheck size={16} /><span>Done</span>
            </button>
          </div>
        </header>

        {/* ── Main ── */}
        <div className="ie-main">
          <nav className="ie-dock" ref={dockRef} aria-label="Editing tools">
            {DOCK.map((t) => (
              <button
                key={t.id}
                type="button"
                className="ie-tool"
                aria-pressed={tool === t.id && !handMode}
                aria-label={t.label}
                onClick={() => openTool(t.id)}
              >
                <t.icon size={20} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div
            ref={setWs}
            className="ie-ws"
            data-cursor={cursor}
            onPointerDown={onWsPointerDown}
            onPointerMove={onWsPointerMove}
            onPointerUp={onWsPointerUp}
            onPointerCancel={onWsPointerUp}
          >
            {ready && (
              <div className="ie-stagewrap">
                <Stage
                  ref={stageRef}
                  width={midW}
                  height={midH}
                  onMouseDown={onStageDown}
                  onTouchStart={onStageDown}
                  onMouseMove={onStageMove}
                  onTouchMove={onStageMove}
                  onMouseUp={onStageUp}
                  onTouchEnd={onStageUp}
                  onMouseLeave={onStageUp}
                  onClick={onStageClick}
                  onTap={onStageClick}
                >
                  <Layer>
                    <Group ref={worldGroupRef} x={viewportX} y={viewportY} scaleX={effScale} scaleY={effScale}>
                      <Group clipX={0} clipY={0} clipWidth={bgW} clipHeight={bgH}>
                        {bgImage && <KonvaImage image={bgImage} x={0} y={0} width={bgW} height={bgH} listening={false} />}
                        {objectsToDraw.map(renderObj)}
                        {tool === 'draw' && (
                          <Line
                            ref={drawingLineRef}
                            points={EMPTY_POINTS}
                            stroke={drawColor}
                            strokeWidth={strokeSize}
                            opacity={strokeOpacity}
                            tension={0.4}
                            lineCap="round"
                            lineJoin="round"
                            listening={false}
                          />
                        )}
                        {showGuides && (
                          <>
                            <Line points={[bgW / 2, 0, bgW / 2, bgH]} stroke="rgba(255,255,255,0.5)" strokeWidth={1 / effScale} dash={[8 / effScale, 8 / effScale]} listening={false} />
                            <Line points={[0, bgH / 2, bgW, bgH / 2]} stroke="rgba(255,255,255,0.5)" strokeWidth={1 / effScale} dash={[8 / effScale, 8 / effScale]} listening={false} />
                            {[1 / 3, 2 / 3].map((f) => (
                              <React.Fragment key={f}>
                                <Line points={[bgW * f, 0, bgW * f, bgH]} stroke="rgba(255,255,255,0.3)" strokeWidth={1 / effScale} dash={[4 / effScale, 4 / effScale]} listening={false} />
                                <Line points={[0, bgH * f, bgW, bgH * f]} stroke="rgba(255,255,255,0.3)" strokeWidth={1 / effScale} dash={[4 / effScale, 4 / effScale]} listening={false} />
                              </React.Fragment>
                            ))}
                          </>
                        )}
                        {snap.vx !== null && <Line points={[snap.vx, 0, snap.vx, bgH]} stroke="#FF3B8E" strokeWidth={1.5 / effScale} listening={false} />}
                        {snap.hy !== null && <Line points={[0, snap.hy, bgW, snap.hy]} stroke="#FF3B8E" strokeWidth={1.5 / effScale} listening={false} />}
                      </Group>
                      <Rect x={0} y={0} width={bgW} height={bgH} stroke="rgba(255,255,255,0.22)" strokeWidth={1 / effScale} listening={false} />
                    </Group>
                  </Layer>
                  <Layer>
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled
                      enabledAnchors={transformerAnchors}
                      anchorSize={isMobile ? 18 : 11}
                      anchorCornerRadius={9}
                      anchorStroke={ACCENT}
                      anchorFill="#FFFFFF"
                      borderStroke={ACCENT}
                      borderStrokeWidth={1.5}
                      padding={4}
                      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                      rotationSnapTolerance={4}
                      boundBoxFunc={(oldBox, newBox) => (newBox.width < 12 || newBox.height < 12 ? oldBox : newBox)}
                    />
                  </Layer>
                </Stage>
              </div>
            )}

            {/* Inline text editor */}
            {editingObj && editorStyle && (
              <textarea
                ref={textRef}
                className="ie-textedit"
                style={editorStyle}
                value={editValue}
                rows={1}
                aria-label="Edit text"
                spellCheck={false}
                onChange={(e) => {
                  editValueRef.current = e.target.value;
                  setEditValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commitEdit(); }
                }}
              />
            )}

            {/* Crop overlay */}
            {cropMode && (
              <div className="ie-crop">
                <Cropper
                  image={doc.originalImage.src}
                  crop={doc.crop.position}
                  zoom={doc.crop.zoom}
                  rotation={cropRotation}
                  aspect={doc.crop.aspect || bgW / bgH}
                  showGrid
                  objectFit="contain"
                  maxZoom={8}
                  onCropChange={(pos) => dispatchDoc({ type: 'SET_CROP', payload: { position: pos } })}
                  onZoomChange={(z) => dispatchDoc({ type: 'SET_CROP_ZOOM', payload: { zoom: z } })}
                  onRotationChange={setCropRotation}
                  onCropComplete={handleCropComplete}
                />
                <div className="ie-crop-actions">
                  <button type="button" className="ie-btn-sec" onClick={() => setTool('select')}><IClose size={16} /> Cancel</button>
                  <button type="button" className="ie-btn" onClick={applyCrop} disabled={!!busy}><ICheck size={16} /> Apply</button>
                </div>
              </div>
            )}

            {/* Floating: info badge */}
            {!cropMode && (
              <div className="ie-float ie-badge" aria-hidden="true">
                <b>{resolutionBadge(bgW, bgH)}</b>
                <span>{bgW}×{bgH}</span>
              </div>
            )}

            {/* Floating: view tools */}
            {!cropMode && (
              <div className="ie-float ie-view" role="toolbar" aria-label="View tools">
                <button
                  type="button"
                  className="ie-iconbtn"
                  data-active={handMode}
                  aria-pressed={handMode}
                  aria-label="Hand tool (H)"
                  title="Pan (H or hold Space)"
                  onClick={() => setHandMode((p) => !p)}
                >
                  <IHand size={17} />
                </button>
                <button
                  type="button"
                  className="ie-iconbtn"
                  data-active={showGuides}
                  aria-pressed={showGuides}
                  aria-label="Grid guides"
                  title="Grid guides"
                  onClick={() => setShowGuides((p) => !p)}
                >
                  <IGrid size={17} />
                </button>
                <button
                  type="button"
                  className="ie-iconbtn"
                  data-active={showOriginal}
                  aria-label="Hold to compare with original"
                  title="Hold to compare with original"
                  onPointerDown={(e) => { e.stopPropagation(); setShowOriginal(true); }}
                  onPointerUp={() => setShowOriginal(false)}
                  onPointerLeave={() => setShowOriginal(false)}
                  onPointerCancel={() => setShowOriginal(false)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <ICompare size={17} />
                </button>
              </div>
            )}

            {/* Floating: contextual layer bar */}
            <AnimatePresence>
              {selObj && !selObj.isBackground && selectMode && !editingId && !cropMode && (
                <motion.div
                  key="ctx"
                  className="ie-float ie-ctx"
                  role="toolbar"
                  aria-label="Layer actions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.16 }}
                >
                  {selObj.type === 'text' && (
                    <button type="button" className="ie-iconbtn" aria-label="Edit text" title="Edit text" onClick={() => startEdit(selObj.id)}><IType size={17} /></button>
                  )}
                  <button type="button" className="ie-iconbtn" data-active={tool === 'props'} aria-label="Properties" title="Properties" onClick={() => openTool('props')}><IProps size={17} /></button>
                  <span className="ie-ctx-sep" />
                  <button type="button" className="ie-iconbtn" aria-label="Bring forward" title="Bring forward" onClick={() => reorder(selObj.id, 'up')}><IUp size={17} /></button>
                  <button type="button" className="ie-iconbtn" aria-label="Send backward" title="Send backward" onClick={() => reorder(selObj.id, 'down')}><IDown size={17} /></button>
                  <button type="button" className="ie-iconbtn" aria-label="Duplicate" title="Duplicate (Ctrl+D)" onClick={() => dupObj(selObj.id)}><ICopy size={17} /></button>
                  <button type="button" className="ie-iconbtn" aria-label={selObj.locked ? 'Unlock' : 'Lock'} title={selObj.locked ? 'Unlock' : 'Lock'} onClick={() => toggleLock(selObj.id)}>
                    {selObj.locked ? <ILock size={17} /> : <IUnlock size={17} />}
                  </button>
                  <button type="button" className="ie-iconbtn" data-danger="true" aria-label="Delete" title="Delete (Del)" onClick={() => delObj(selObj.id)}><ITrash size={17} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating: zoom */}
            {!cropMode && (
              <div className="ie-float ie-zoom" role="toolbar" aria-label="Zoom">
                <button type="button" className="ie-iconbtn" aria-label="Zoom out" onClick={() => zoomBy(0.8)}><IMinus size={16} /></button>
                <button
                  type="button"
                  className="ie-zoom-val"
                  aria-label={`Zoom ${percent}%. Press to toggle fit and 100%`}
                  onClick={() => (fitMode === 'fit' && zoom === 1 ? actualSize() : fitView())}
                >
                  {percent}%
                </button>
                <button type="button" className="ie-iconbtn" aria-label="Zoom in" onClick={() => zoomBy(1.25)}><IPlus size={16} /></button>
                <button type="button" className="ie-iconbtn" aria-label="Fit to screen" title="Fit to screen (0)" onClick={fitView}><IMaximize size={16} /></button>
              </div>
            )}
          </div>

          {panelOpen && renderPanel()}
        </div>

        {/* ── Overlays ── */}
        <AnimatePresence>
          {showExport && (
            <ExportDialog
              key="export"
              onClose={() => setShowExport(false)}
              onExport={handleExportAction}
              naturalW={bgW}
              naturalH={bgH}
              formats={formats}
              defaultFormat={defaultFormat}
              busy={!!busy}
            />
          )}
          {confirmClose && (
            <ConfirmDialog
              key="confirm"
              title="Discard your edits?"
              body="You have unsaved changes. If you leave now they will be lost."
              confirmLabel="Discard"
              cancelLabel="Keep editing"
              onCancel={() => setConfirmClose(false)}
              onConfirm={() => { setConfirmClose(false); onClose?.(); }}
            />
          )}
        </AnimatePresence>

        {busy && (
          <div className="ie-busy" role="status" aria-live="polite">
            <LoadingSpinner size={40} />
            <span>{busy}</span>
          </div>
        )}
      </div>
    </MotionConfig>
  );
});

export default memo(ImageEditor);
