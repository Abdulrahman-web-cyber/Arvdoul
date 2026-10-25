// src/screens/IntroScreen.jsx
// Arvdoul — "The Digital Nation" welcome screen. ONE self-contained file.
//
// Imports (all already in your project): react · react-router-dom · framer-motion ·
// @context/ThemeContext · @context/AuthContext · @components/Shared/ThemeToggle.
// Nothing else. Logo, wordmark, icons, glass material, legal documents and styles live here.
//
// v4 — refinement pass:
//   Background: canonical background tokens only; removed ambient background glow pools and
//               the decorative logo halo. No decorative background effects behind content.
//   Glass:      stronger dark-theme material separation, more controlled transparency,
//               cleaner gradient rim, quieter grain, refined borders, clearer inner highlights,
//               and predictable fallback behaviour without backdrop-filter.
//   Wordmark:   preserved master paths, letter offsets, gradient and drawing animation.
//   Icons:      preserved the unified icon registry and custom feature glyphs.
//   Buttons:    corrected slow-navigation retry behaviour. A stalled action becomes retryable
//               instead of remaining permanently pending.
//   Legal:      preserved the document content and tab semantics; corrected section scrolling
//               to calculate positions relative to the actual scroll container.
//   Reliability: retained direct legal URLs, navigation recovery, focus management, reduced
//                motion support and the render error boundary.
//
// IMPORTANT — LEGAL TEXT STILL NEEDS HUMAN REVIEW.
// Nothing below has been verified against the actual product, infrastructure or legal counsel.
// Before launch:
//   1. Confirm MIN_AGE (14 here) matches registration, date-of-birth validation, Firebase rules,
//      account enforcement and applicable law.
//   2. Fill LEGAL.entity and LEGAL.contactEmail with verified details.
//   3. Audit Auth, Firestore, Storage, Functions, FCM, analytics, crash reports and other
//      processors against the Privacy Policy; reconcile the coin and creator terms with the
//      actual economy.
//   4. Obtain qualified legal review, including review of applicable Nigerian data-protection
//      requirements.
//   5. Set LEGAL.reviewed = true only after the published documents have genuinely been reviewed.
//   6. Record required registration acceptance with the applicable document version and timestamp.
//      Opening these documents is not consent.

import React, {
  Component,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import ThemeToggle from "@components/Shared/ThemeToggle";

/* ═════════════════════════════ configuration ═════════════════════════════ */

const ROUTES = Object.freeze({
  signup: "/signup",
  login: "/login",
  home: "/home",
});

/** Single source of truth for the interface palette. */
const TOKENS = Object.freeze({
  bg: {
    dark: "#03071B",
    light: "#F6F8FC",
  },
  violet: "#8B1EF3",
  indigo: "#4431F7",
  blue: "#055BFB",
});

const BG = TOKENS.bg;

const UI_GRADIENT = `linear-gradient(105deg, ${TOKENS.violet} 0%, ${TOKENS.indigo} 52%, ${TOKENS.blue} 100%)`;

// Copy directions. Select the one that accurately reflects the shipped product.
const COPY_VARIANTS = Object.freeze({
  identity: "Be yourself, out loud.",
  connection: "Find your people, wherever they are.",
  creation: "Make something that’s actually yours.",
  nation: "One nation for your identity, your people and your next move.",
  blend: "Be yourself out loud. Find your people. Make what’s next.",
});

const COPY_ACTIVE = "blend";

const COPY = Object.freeze({
  descriptor: "The Digital Nation",
  heading: "Welcome to Arvdoul",
  support: COPY_VARIANTS[COPY_ACTIVE],
  closing: ["Real people", "Real connections", "A stronger tomorrow"],
});

// Keep in sync with registration validation and the actual product policy.
const MIN_AGE = 14;

const LEGAL = Object.freeze({
  version: "1.0",
  effective: "October 24, 2026",
  updated: "October 24, 2026",
  reviewed: false,
  entity: "",
  contactEmail: "",
});

const SLOW_NAV_MS = 8000;

/* ═════════════════════════════ brand artwork ═════════════════════════════ */

// Master logo geometry and nine-stop gradient.
// Preserve these paths unless a separate master-logo revision is explicitly approved.
const LOGO = Object.freeze({
  viewBox: 512,
  orbit: {
    d: "M328.2 446.3 A197 197 0 1 1 390.3 407.1",
    width: 39,
  },
  monogram: {
    d: "M154 352 L226.4 192 Q256.5 119 286.6 192 L386 408",
    width: 47.5,
  },
  crossbar: {
    d: "M154 352 Q256 257 358 352",
    width: 41,
  },
  gradient: {
    x1: 60,
    y1: 96,
    x2: 440,
    y2: 446,
    stops: [
      [0, "#BD03F6"],
      [0.2, "#A508F9"],
      [0.3, "#9210F8"],
      [0.4, "#7A1AF8"],
      [0.5, "#5A25FA"],
      [0.6, "#3434FA"],
      [0.7, "#1048FA"],
      [0.8, "#0160FB"],
      [1, "#0074F8"],
    ],
  },
});

// Custom-drawn lettering. Geometry and spacing preserved.
const WORDMARK = Object.freeze({
  label: "Arvdoul",
  width: 496,
  height: 100,
  viewBox: "-6 -10 508 120",
  stroke: 18,
  letters: [
    {
      ch: "A",
      x: 0,
      paths: [
        "M9 91 L36 26 Q50 -8 64 26 L91 91",
        "M9 91 Q50 29 91 91",
      ],
    },
    {
      ch: "r",
      x: 106,
      paths: [
        "M9 91 V43",
        "M9 66 Q9 43 33 43",
      ],
    },
    {
      ch: "v",
      x: 156,
      paths: ["M9 43 L40 91 L71 43"],
    },
    {
      ch: "d",
      x: 240,
      paths: [
        "M9 67 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0",
        "M57 9 V91",
      ],
    },
    {
      ch: "o",
      x: 318,
      paths: ["M9 67 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0"],
    },
    {
      ch: "u",
      x: 396,
      paths: [
        "M9 43 V67 A24 24 0 0 0 57 67",
        "M57 43 V91",
      ],
    },
    {
      ch: "l",
      x: 478,
      paths: ["M9 9 V91"],
    },
  ],
});

const WORDMARK_TREATMENT = "signature";

const WORDMARK_STOPS = Object.freeze({
  signature: LOGO.gradient.stops,
  refined: LOGO.gradient.stops,
  material: [
    [0, "#BD03F6"],
    [0.35, "#9A22FA"],
    [0.5, "#6E56FF"],
    [0.65, "#2F52FB"],
    [1, "#0074F8"],
  ],
});

/*
 * ICON SYSTEM
 *   Grid:       24 × 24, live area approximately 2 → 22.
 *   Stroke:     1.8 base, optically increased for smaller sizes.
 *   Caps/joins: round / round.
 *   Concepts:   one primary idea per icon.
 *   Colour:     shared theme-aware gradient or currentColor.
 */
const GLYPHS = Object.freeze({
  identity: [
    "M4.5 13v-2.5a7.5 7.5 0 0 1 15 0V13",
    "M8.2 20v-9.5a3.8 3.8 0 0 1 7.6 0V14",
    "M12 11v9",
  ],

  community: [
    "M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M6.5 20a5.5 5.5 0 0 1 11 0",
    "M5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    "M2.5 18a3.5 3.5 0 0 1 3.2-3.5",
    "M19 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    "M21.5 18a3.5 3.5 0 0 0-3.2-3.5",
  ],

  connect: [
    "M5 2.5h7a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H8.5L5 11.5v-3a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z",
    "M12 12h7a2 2 0 0 1 2 2v7l-3.5-3H12a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z",
  ],

  economy: [
    "M5.5 8h13A2.5 2.5 0 0 1 21 10.5v6a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-6A2.5 2.5 0 0 1 5.5 8Z",
    "M21 12.5h-3.5a2 2 0 0 0 0 4H21",
    "M6 8a4 4 0 0 1 8 0",
  ],

  create: [
    "M9.5 4H7a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4v-3.5",
    "M16.5 3q.5 4 4.5 4.5-4 .5-4.5 4.5-.5-4-4.5-4.5 4-.5 4.5-4.5Z",
  ],

  grow: [
    "M6.5 16.5V13",
    "M12 16.5V9",
    "M17.5 16.5V5",
    "M4 20h16",
  ],

  arrow: [
    "M5 12h14",
    "m13 6 6 6-6 6",
  ],

  close: [
    "M6 6l12 12",
    "M18 6 6 18",
  ],

  up: [
    "M12 19V5",
    "m6 11 6-6 6 6",
  ],

  chevron: ["m6 9 6 6 6-6"],
});

// Confirm that the Coins feature is actually available before launch.
const FEATURES = Object.freeze([
  { key: "identity", label: "Be you" },
  { key: "community", label: "Your crew" },
  { key: "connect", label: "Chat" },
  { key: "economy", label: "Coins" },
  { key: "create", label: "Create" },
  { key: "grow", label: "Level up" },
]);

const GLYPH_FILLS = Object.freeze({
  community: [0],
  connect: [0, 1],
  economy: [0],
  create: [1],
});

// Preserve delimiter characters instead of removing them, preventing avoidable ID collisions.
const safeId = (raw) => String(raw).replace(/[^a-zA-Z0-9_-]/g, "_");

function BrandGradient({
  id,
  x1,
  y1,
  x2,
  y2,
  stops = LOGO.gradient.stops,
}) {
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
    >
      {stops.map(([offset, color]) => (
        <stop
          key={offset}
          offset={offset}
          stopColor={color}
        />
      ))}
    </linearGradient>
  );
}

/** Master logo filters. The logo paths and gradient remain unchanged. */
function BrandFilters({ ids }) {
  return (
    <>
      <filter
        id={ids.cast}
        x="-15%"
        y="-15%"
        width="130%"
        height="135%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur
          in="SourceAlpha"
          stdDeviation="9"
          result="b1"
        />
        <feOffset in="b1" dy="8" result="o1" />
        <feFlood
          floodColor="#3B44E0"
          floodOpacity="0.26"
        />
        <feComposite
          in2="o1"
          operator="in"
          result="wide"
        />

        <feGaussianBlur
          in="SourceAlpha"
          stdDeviation="1.8"
          result="b2"
        />
        <feOffset in="b2" dy="2.5" result="o2" />
        <feFlood
          floodColor="#2A2FA0"
          floodOpacity="0.30"
        />
        <feComposite
          in2="o2"
          operator="in"
          result="tight"
        />

        <feMerge>
          <feMergeNode in="wide" />
          <feMergeNode in="tight" />
        </feMerge>
      </filter>

      <filter
        id={ids.body}
        x="-5%"
        y="-5%"
        width="110%"
        height="110%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur
          in="SourceGraphic"
          stdDeviation="3.8"
          result="blur"
        />
        <feColorMatrix
          in="blur"
          type="matrix"
          result="shape"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -6.5"
        />

        <feComponentTransfer in="shape" result="inv">
          <feFuncA type="table" tableValues="1 0" />
        </feComponentTransfer>

        <feGaussianBlur in="inv" stdDeviation="0.9" result="l1" />
        <feOffset in="l1" dx="1.8" dy="2.2" result="l2" />
        <feComposite
          in="l2"
          in2="shape"
          operator="in"
          result="lm"
        />
        <feFlood
          floodColor="#E9CCFF"
          floodOpacity="0.62"
        />
        <feComposite
          in2="lm"
          operator="in"
          result="rim"
        />

        <feGaussianBlur in="inv" stdDeviation="0.9" result="d1" />
        <feOffset in="d1" dx="-1.8" dy="-2.2" result="d2" />
        <feComposite
          in="d2"
          in2="shape"
          operator="in"
          result="dm"
        />
        <feFlood
          floodColor="#26107E"
          floodOpacity="0.62"
        />
        <feComposite
          in2="dm"
          operator="in"
          result="dark"
        />

        <feGaussianBlur in="inv" stdDeviation="4.5" result="s1" />
        <feOffset in="s1" dx="-3" dy="-4" result="s2" />
        <feComposite
          in="s2"
          in2="shape"
          operator="in"
          result="sm"
        />
        <feFlood
          floodColor="#1B1AA8"
          floodOpacity="0.22"
        />
        <feComposite
          in2="sm"
          operator="in"
          result="soft"
        />

        <feMerge>
          <feMergeNode in="shape" />
          <feMergeNode in="soft" />
          <feMergeNode in="dark" />
          <feMergeNode in="rim" />
        </feMerge>
      </filter>
    </>
  );
}

/** Exact master logo, static and vector-based. */
const BrandMark = memo(function BrandMark({ className, style }) {
  const uid = `av${safeId(useId())}`;
  const ids = {
    brand: `${uid}-brand`,
    shape: `${uid}-shape`,
    cast: `${uid}-cast`,
    body: `${uid}-body`,
  };

  const g = LOGO.gradient;

  return (
    <svg
      className={className}
      style={{
        display: "block",
        overflow: "visible",
        ...style,
      }}
      viewBox={`0 0 ${LOGO.viewBox} ${LOGO.viewBox}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <BrandGradient
          id={ids.brand}
          x1={g.x1}
          y1={g.y1}
          x2={g.x2}
          y2={g.y2}
        />

        <g
          id={ids.shape}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d={LOGO.orbit.d}
            strokeWidth={LOGO.orbit.width}
          />
          <path
            d={LOGO.monogram.d}
            strokeWidth={LOGO.monogram.width}
          />
          <path
            d={LOGO.crossbar.d}
            strokeWidth={LOGO.crossbar.width}
          />
        </g>

        <BrandFilters ids={ids} />
      </defs>

      <g filter={`url(#${ids.cast})`} stroke="#000">
        <use href={`#${ids.shape}`} />
      </g>

      <g
        filter={`url(#${ids.body})`}
        stroke={`url(#${ids.brand})`}
      >
        <use href={`#${ids.shape}`} />
      </g>
    </svg>
  );
});

/**
 * One vector wordmark layer.
 * Reduced motion or unavailable animation leaves the complete word visible.
 */
const Wordmark = memo(function Wordmark({
  treatment = WORDMARK_TREATMENT,
}) {
  const uid = `aw${safeId(useId())}`;
  const W = WORDMARK;
  const stops = WORDMARK_STOPS[treatment] || WORDMARK_STOPS.signature;

  return (
    <div
      className="arv-word"
      data-treatment={treatment}
      role="img"
      aria-label={W.label}
    >
      <svg
        viewBox={W.viewBox}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {W.letters.map((letter, i) => (
            <BrandGradient
              key={`${letter.ch}${i}`}
              id={`${uid}-g${i}`}
              x1={-letter.x}
              y1={-90}
              x2={W.width - letter.x}
              y2={190}
              stops={stops}
            />
          ))}
        </defs>

        <g
          fill="none"
          strokeWidth={W.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {W.letters.map((letter, i) => (
            <g
              key={`${letter.ch}${i}`}
              transform={`translate(${letter.x} 0)`}
              stroke={`url(#${uid}-g${i})`}
            >
              {letter.paths.map((d) => (
                <path
                  key={d}
                  d={d}
                  pathLength="1"
                  className="arv-pen"
                  style={{ "--i": i }}
                />
              ))}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
});

/** Shared, theme-aware SVG icon renderer. */
const ArvdoulGlyph = memo(function ArvdoulGlyph({
  name,
  size = 28,
  weight,
  title,
  gradient = true,
  className,
}) {
  const uid = `ag${safeId(useId())}`;
  const paths = GLYPHS[name];

  if (!paths) return null;

  const strokeWidth =
    weight || (size < 20 ? 2.2 : size <= 24 ? 2 : 1.8);

  const fills = gradient ? GLYPH_FILLS[name] : undefined;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={gradient ? `url(#${uid})` : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {gradient && (
        <defs>
          <linearGradient
            id={uid}
            gradientUnits="userSpaceOnUse"
            x1="2"
            y1="2"
            x2="22"
            y2="22"
          >
            <stop
              offset="0"
              style={{ stopColor: "var(--arv-icon-a)" }}
            />
            <stop
              offset="1"
              style={{ stopColor: "var(--arv-icon-b)" }}
            />
          </linearGradient>

          {fills && (
            <linearGradient
              id={`${uid}-f`}
              gradientUnits="userSpaceOnUse"
              x1="2"
              y1="2"
              x2="22"
              y2="22"
            >
              <stop
                offset="0"
                style={{
                  stopColor: "var(--arv-icon-a)",
                  stopOpacity: 0.34,
                }}
              />
              <stop
                offset="1"
                style={{
                  stopColor: "var(--arv-icon-b)",
                  stopOpacity: 0.12,
                }}
              />
            </linearGradient>
          )}
        </defs>
      )}

      {paths.map((d, i) => (
        <path
          key={d}
          d={d}
          fill={
            fills && fills.includes(i)
              ? `url(#${uid}-f)`
              : "none"
          }
        />
      ))}
    </svg>
  );
});

/* ═════════════════════════════ legal documents ═════════════════════════════ */

const contactLine = () =>
  LEGAL.contactEmail
    ? `Contact us at ${LEGAL.contactEmail}.`
    : "Contact us through the support options available in the Arvdoul app or on our website.";

const DOCS = Object.freeze({
  terms: {
    title: "Terms of Service",
    intro:
      "These Terms explain the rules for using Arvdoul. Please read them carefully — they form an agreement between you and Arvdoul.",
    sections: [
      {
        id: "acceptance",
        h: "Acceptance of these Terms",
        b: [
          "By creating an account or using Arvdoul’s apps, websites and related services (the “Service”), you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use the Service.",
          "Reading these Terms does not create an account or accept them. You accept them when you register or keep using the Service.",
        ],
      },
      {
        id: "eligibility",
        h: "Who can use Arvdoul",
        b: [
          `You must be at least ${MIN_AGE} years old to create an account, and old enough to form a binding agreement where you live. If you are under the age of majority in your country, you may use the Service only with the permission of a parent or legal guardian. Where the law of your country sets a higher minimum age for online services, that higher age applies.`,
          "We may ask you to confirm your age or identity, and we may remove accounts that do not meet these requirements. You must not use the Service if you are barred from doing so by applicable law.",
        ],
      },
      {
        id: "account",
        h: "Your account",
        b: [
          "Give accurate information when you register and keep it up to date. Keep your sign-in details secure; you are responsible for activity on your account. Tell us promptly if you suspect unauthorised access.",
          "Accounts may not be used to mislead others about who you are, and may not be sold or transferred without our written permission. Where Arvdoul offers verification, you agree to provide accurate information when you use it.",
        ],
      },
      {
        id: "profiles",
        h: "Profiles and visibility",
        b: [
          "Your profile, posts and other content may be public or limited to chosen audiences, depending on the features and settings available to you. Content you make public can be seen, shared and saved by others, including people outside Arvdoul, and we cannot control what they do with it. Check your settings before you post.",
        ],
      },
      {
        id: "content",
        h: "Your content",
        b: [
          "You keep ownership of the content you post. To run the Service, you give Arvdoul a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, display, distribute and adapt your content for the purpose of operating, securing, improving and promoting the Service.",
          "You confirm that you have the rights needed to post your content and that it does not violate the law or anyone else’s rights. When you delete content or your account, this licence ends within a reasonable period, except for copies that others have shared and backups that are removed on a routine schedule.",
        ],
      },
      {
        id: "messages",
        h: "Messages and groups",
        b: [
          "Messages and group conversations are for people who want to hear from you. Do not use them for spam, harassment or unlawful activity. Anyone in a conversation can copy or share what you send, so share carefully.",
          "We may act on conversations that are reported to us or that put people at risk, in line with these Terms and the Privacy Policy.",
        ],
      },
      {
        id: "rules",
        h: "Community rules",
        b: [
          "Arvdoul is built for real people and real connections. You agree not to:",
          {
            list: [
              "break the law or encourage others to do so;",
              "harass, threaten, bully, or promote hatred or violence against any person or group;",
              "post sexual content involving minors, or anything that exploits or endangers children;",
              "impersonate others, run scams, or mislead people about your identity or affiliation;",
              "share malware, spam, or content that infringes intellectual property or privacy rights;",
              "scrape, reverse engineer, or interfere with the Service, or bypass its security or limits.",
            ],
          },
        ],
      },
      {
        id: "moderation",
        h: "Reports, blocking and enforcement",
        b: [
          "Use the tools in the app, where available, to report content or accounts and to block or restrict other people. We may review content and activity to keep the Service safe, and we may remove content, limit features, or suspend or end accounts that break these Terms or put others at risk. In serious cases we may act without notice.",
          "If you think we made a mistake, you can ask us to review our decision through the support options in the app or by contacting us. Where a formal appeal process is available, we will explain how to use it when we tell you about a decision.",
        ],
      },
      {
        id: "payments",
        h: "Coins, creator features and payments",
        b: [
          "Where available, Arvdoul may offer virtual coins, gifts, subscriptions and creator earnings. The rules for each — prices, fees, taxes, expiry, refunds, cancellation, eligibility, payout conditions and availability in your region — are shown in the product before you buy, send, earn or withdraw, and they form part of these Terms.",
          "Unless the product expressly says otherwise at the time, virtual coins are a limited licence to use features of the Service. They are not money, a deposit or stored value, are not a guaranteed balance, and cannot be redeemed for cash. Creator earnings, where offered, depend on eligibility and are not guaranteed.",
          "We may verify your identity, and we may delay, limit or refuse transactions or payouts where we suspect fraud, abuse or a rule violation. Refunds are provided only where the law requires or where the point of sale says so.",
        ],
      },
      {
        id: "ip",
        h: "Intellectual property",
        b: [
          "Arvdoul’s name, logo, design and software belong to Arvdoul and its licensors. These Terms do not give you any right to use them except to use the Service as intended.",
          "If you believe content on Arvdoul infringes your intellectual property, contact us using the details below with enough information to identify the content and your rights, and we will review it.",
        ],
      },
      {
        id: "ending",
        h: "Ending your use of Arvdoul",
        b: [
          "You may stop using the Service and delete your account at any time. Content that others have copied or shared, or that appears in other people’s conversations, may remain visible to them.",
          "We may suspend or end your access if you breach these Terms, if required by law, or if we discontinue the Service. Sections that by their nature should survive termination, including licences already granted for shared copies, disclaimers and limits of liability, continue to apply.",
        ],
      },
      {
        id: "availability",
        h: "The Service “as is”",
        b: [
          "We work to keep Arvdoul reliable and secure, but the Service is provided “as is” and “as available”. We do not guarantee that it will be uninterrupted or error-free, and we may change, add or remove features over time.",
        ],
      },
      {
        id: "liability",
        h: "Limits on liability",
        b: [
          "To the extent permitted by law, Arvdoul is not liable for indirect, incidental, special or consequential losses, or for loss of profits, data or goodwill arising from your use of the Service. Nothing in these Terms limits liability that cannot be limited by law, and your statutory consumer rights remain unaffected.",
        ],
      },
      {
        id: "changes",
        h: "Changes to these Terms",
        b: [
          "We may update these Terms as the Service evolves. If a change is material we will tell you in the app or by another reasonable means before it takes effect, and we will update the version and dates shown above. Continuing to use the Service after a change takes effect means you accept the updated Terms.",
        ],
      },
      {
        id: "contact",
        h: "Contact",
        b: [contactLine()],
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    intro:
      "This policy explains what personal data Arvdoul collects, why we collect it, how it is used and shared, and the choices and rights you have.",
    sections: [
      {
        id: "who",
        h: "Who we are",
        b: [
          LEGAL.entity
            ? `${LEGAL.entity} (“Arvdoul”, “we”, “us”) operates the Arvdoul apps, websites and related services and is responsible for the personal data described in this policy.`
            : "Arvdoul (“we”, “us”) operates the Arvdoul apps, websites and related services and is responsible for the personal data described in this policy.",
        ],
      },
      {
        id: "collect",
        h: "Information we collect",
        b: [
          "What we collect depends on the features you use. It can include:",
          {
            list: [
              "Information you provide — such as your name, username, email address or phone number, password or sign-in credentials, date of birth, profile details, and the posts, comments, messages and other content you create.",
              "Information created by your use — such as interactions, connections, settings, purchases and creator activity where available, and records of reports or support requests.",
              "Device and technical information — such as device type, operating system, app version, language, IP address, approximate location derived from your IP address, and crash and performance logs.",
              "Information from others — such as content in which other users mention or tag you, and basic profile information from a sign-in provider if you choose to use one.",
            ],
          },
        ],
      },
      {
        id: "use",
        h: "How we use your information",
        b: [
          {
            list: [
              "to create and secure your account, authenticate you and provide the features you use;",
              "to show you content, people and communities, and to deliver messages and notifications;",
              "to process purchases, rewards and payouts where those features are available;",
              "to keep Arvdoul safe: preventing fraud, abuse, spam and security incidents, and enforcing our Terms;",
              "to understand performance, fix problems and improve the Service;",
              "to communicate with you about the Service and respond to your requests;",
              "to comply with legal obligations and protect rights, safety and property.",
            ],
          },
        ],
      },
      {
        id: "basis",
        h: "Why we are allowed to use it",
        b: [
          "Depending on the situation, we rely on your consent, on what is needed to provide the Service you asked for, on our legitimate interests in running and protecting it, or on legal obligations. Where we rely on consent, you can withdraw it at any time.",
        ],
      },
      {
        id: "sharing",
        h: "How information is shared",
        b: [
          "Your profile and content are visible to others according to the features you use and the privacy settings available to you.",
          "We share information with service providers who help us operate the Service — for example hosting, authentication, storage, analytics, communications and payment processing — and only as needed for them to perform those services for us. We may also share information when required by law or legal process, to protect people’s safety, or as part of a business transfer such as a merger or acquisition. We will share information in other ways only with your consent.",
        ],
      },
      {
        id: "transfers",
        h: "International processing",
        b: [
          "Arvdoul and its providers may process data in countries other than the one where you live. Where required, we use appropriate safeguards so that your data stays protected when it is transferred.",
        ],
      },
      {
        id: "retention",
        h: "How long we keep information",
        b: [
          "We keep personal data for as long as your account is active or as needed to provide the Service. When you delete your account we delete or de-identify your personal data within a reasonable period, except where we must keep some information to meet legal obligations, resolve disputes, prevent abuse or maintain security, and in routine backups until they are overwritten.",
        ],
      },
      {
        id: "rights",
        h: "Your rights and choices",
        b: [
          "Depending on where you live — including under the Nigeria Data Protection Act 2023 where it applies — you may have the right to access your personal data, correct it, delete it, restrict or object to certain processing, withdraw consent, and receive a copy of your data in a portable format.",
          "You can manage much of your information in the app’s settings where those controls are available. To make a request or ask a question, " +
            (LEGAL.contactEmail
              ? `contact ${LEGAL.contactEmail}`
              : "use the support options in the app or on our website") +
            ". You may also complain to your local data protection authority, such as the Nigeria Data Protection Commission.",
        ],
      },
      {
        id: "security",
        h: "Security",
        b: [
          "We use technical and organisational measures designed to protect personal data against unauthorised access, loss and misuse. No system is completely secure, so please use a strong, unique password and keep your account details private.",
        ],
      },
      {
        id: "age",
        h: "Children and minimum age",
        b: [
          `Arvdoul is not intended for people under ${MIN_AGE}, and we do not knowingly collect personal data from them. If you believe someone under that age has given us personal data, contact us and we will take appropriate steps to remove it.`,
        ],
      },
      {
        id: "storage",
        h: "Cookies and on-device storage",
        b: [
          "We use cookies, local storage and similar technologies to keep you signed in, remember preferences such as your theme, protect the Service, and understand how it performs. You can control these through your browser or device settings, though some features may not work without them.",
        ],
      },
      {
        id: "changes",
        h: "Changes to this policy",
        b: [
          "We may update this policy from time to time. If a change is material we will notify you in the app or by another reasonable means before it takes effect, and we will update the version and dates shown above.",
        ],
      },
      {
        id: "contact",
        h: "Contact",
        b: [contactLine()],
      },
    ],
  },
});

const LEGAL_KEYS = Object.freeze(["terms", "privacy"]);

const LEGAL_TAB_LABEL = Object.freeze({
  terms: "Terms",
  privacy: "Privacy",
});

/** "#terms", "#privacy/rights" → { key, section }. */
function parseLegalHash(hash) {
  const m = /^#(terms|privacy)(?:\/([a-z0-9-]+))?$/i.exec(
    hash || ""
  );

  if (!m) {
    return {
      key: null,
      section: null,
    };
  }

  const key = m[1].toLowerCase();
  const section = m[2] ? m[2].toLowerCase() : null;

  const valid =
    section &&
    DOCS[key].sections.some((s) => s.id === section);

  return {
    key,
    section: valid ? section : null,
  };
}

const LegalDocument = memo(function LegalDocument({ doc }) {
  return (
    <>
      <p className="arv-doc__intro">{doc.intro}</p>

      {doc.sections.map((s, n) => (
        <section
          key={s.id}
          className="arv-doc__section"
        >
          <h3
            data-sec={s.id}
            tabIndex={-1}
          >
            {n + 1}. {s.h}
          </h3>

          {s.b.map((item, i) =>
            typeof item === "string" ? (
              <p key={i}>{item}</p>
            ) : (
              <ul key={i}>
                {item.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )
          )}
        </section>
      ))}
    </>
  );
});

/* ═══════════════════════════════ hooks ═══════════════════════════════ */

const DARK_QUERY = "(prefers-color-scheme: dark)";

const systemIsDark = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(DARK_QUERY).matches;

/** Resolve "system" | "dark" | "light" into the currently effective theme. */
function useResolvedTheme(theme) {
  const [sysDark, setSysDark] = useState(systemIsDark);

  useEffect(() => {
    if (theme === "dark" || theme === "light") {
      return undefined;
    }

    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }

    const mq = window.matchMedia(DARK_QUERY);
    const onChange = (e) => setSysDark(e.matches);

    setSysDark(mq.matches);

    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
    } else {
      mq.addListener(onChange);
    }

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", onChange);
      } else {
        mq.removeListener(onChange);
      }
    };
  }, [theme]);

  if (theme === "dark" || theme === "light") {
    return theme;
  }

  return sysDark ? "dark" : "light";
}

/** Update browser / Android theme colour without overwriting another owner's changes. */
function useThemeColorMeta(color) {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    let meta = document.querySelector(
      'meta[name="theme-color"]'
    );

    const created = !meta;

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }

    const previous = meta.getAttribute("content");

    meta.setAttribute("content", color);

    return () => {
      if (created) {
        meta.remove();
        return;
      }

      if (meta.getAttribute("content") !== color) {
        return;
      }

      if (previous === null) {
        meta.removeAttribute("content");
      } else {
        meta.setAttribute("content", previous);
      }
    };
  }, [color]);
}

/**
 * Single-flight navigation.
 *
 * Status:
 *   idle
 *   navigating-to-signup
 *   navigating-to-login
 *   error
 *
 * A slow transition allows an explicit retry. The retry uses a full page load
 * to recover from a possible stalled lazy-loaded route.
 */
function useAccountNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [status, setStatus] = useState("idle");
  const [slow, setSlow] = useState(false);

  const lock = useRef(false);
  const alive = useRef(true);
  const timer = useRef(0);
  const hardRetry = useRef(null);
  const pathRef = useRef(pathname);
  const startPath = useRef(pathname);

  pathRef.current = pathname;

  const reset = useCallback(() => {
    lock.current = false;
    hardRetry.current = null;

    window.clearTimeout(timer.current);

    if (alive.current) {
      setStatus("idle");
      setSlow(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;

    const onShow = (e) => {
      if (e.persisted) {
        reset();
      }
    };

    window.addEventListener("pageshow", onShow);

    return () => {
      alive.current = false;
      window.removeEventListener("pageshow", onShow);
      window.clearTimeout(timer.current);
    };
  }, [reset]);

  // A pathname change is evidence that the route transition completed.
  useEffect(() => {
    if (pathname !== startPath.current) {
      startPath.current = pathname;
      reset();
    }
  }, [pathname, reset]);

  const go = useCallback(
    (key) => {
      if (lock.current) {
        return;
      }

      const to = ROUTES[key];

      if (!to) {
        console.error(
          `[Arvdoul Intro] Unknown navigation target: ${String(key)}`
        );
        return;
      }

      const hard = hardRetry.current === key;

      lock.current = true;
      startPath.current = pathRef.current;

      window.clearTimeout(timer.current);

      setStatus(`navigating-to-${key}`);
      setSlow(false);

      timer.current = window.setTimeout(() => {
        if (!alive.current || !lock.current) {
          return;
        }

        // Do not present this as a successful or failed navigation.
        // Release the lock so the user can deliberately retry.
        lock.current = false;
        hardRetry.current = key;
        setSlow(true);
      }, SLOW_NAV_MS);

      try {
        if (hard) {
          window.location.assign(to);
        } else {
          navigate(to);
        }
      } catch (error) {
        console.error(
          "[Arvdoul Intro] Navigation failed:",
          error && error.message ? error.message : error
        );

        window.clearTimeout(timer.current);

        lock.current = false;
        hardRetry.current = key;

        setSlow(false);
        setStatus("error");
      }
    },
    [navigate]
  );

  const navigating = status.startsWith("navigating-to-");

  const target = navigating
    ? status.slice("navigating-to-".length)
    : null;

  return {
    go,
    status,
    slow,
    locked: navigating && !slow,
    target,
  };
}

/* ═══════════════════════════════ buttons ═══════════════════════════════ */

const IntroActionButton = memo(function IntroActionButton({
  variant,
  label,
  pendingLabel,
  pending,
  blocked,
  arrow,
  onPress,
}) {
  const inactive = pending || blocked;
  const chip = pending || arrow;

  return (
    <button
      type="button"
      className={`arv-btn arv-btn--${variant}${chip ? " arv-btn--chip" : ""}`}
      onClick={(e) => {
        if (inactive) {
          e.preventDefault();
          return;
        }

        onPress();
      }}
      aria-disabled={inactive ? "true" : undefined}
      aria-busy={pending ? "true" : undefined}
      data-state={
        pending
          ? "pending"
          : blocked
          ? "blocked"
          : "idle"
      }
    >
      <span>{pending ? pendingLabel : label}</span>

      {chip && (
        <span
          className="arv-btn__chip"
          aria-hidden="true"
        >
          {pending ? (
            <span className="arv-spinner" />
          ) : (
            <ArvdoulGlyph
              name="arrow"
              size={20}
              weight={2.2}
              gradient={false}
            />
          )}
        </span>
      )}
    </button>
  );
});

/* ═══════════════════════════════ legal sheet ═══════════════════════════════ */

const FOCUSABLE =
  'a[href],button:not([disabled]),summary,[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])';

function LegalSheet({
  docKey,
  sectionId,
  onClose,
  onSwitch,
  linkState,
  locationKey,
  reduced,
}) {
  const uid = safeId(useId());
  const isPresent = useIsPresent();

  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const barRef = useRef(null);
  const tocRef = useRef(null);
  const tabRefs = useRef([]);
  const frame = useRef(0);
  const firstRun = useRef(true);

  const [showTop, setShowTop] = useState(false);

  const doc = DOCS[docKey];

  const live = useRef({
    onClose,
    isPresent,
    docKey,
  });

  useEffect(() => {
    live.current = {
      onClose,
      isPresent,
      docKey,
    };
  });

  // Move focus into the sheet, trap Tab, handle Escape, restore focus on exit.
  useEffect(() => {
    const active = document.activeElement;
    const opener =
      active && active !== document.body
        ? active
        : null;

    const panel = panelRef.current;

    const selected =
      panel &&
      panel.querySelector(
        '[role="tab"][aria-selected="true"]'
      );

    if (selected) {
      selected.focus({ preventScroll: true });
    }

    const onKey = (e) => {
      if (!live.current.isPresent) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        live.current.onClose();
        return;
      }

      if (e.key !== "Tab" || !panel) {
        return;
      }

      const nodes = [
        ...panel.querySelectorAll(FOCUSABLE),
      ].filter((n) => n.getClientRects().length > 0);

      if (!nodes.length) {
        return;
      }

      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];

      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        firstNode.focus();
      } else if (
        e.shiftKey &&
        document.activeElement === firstNode
      ) {
        e.preventDefault();
        lastNode.focus();
      } else if (
        !e.shiftKey &&
        document.activeElement === lastNode
      ) {
        e.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);

      window.cancelAnimationFrame(frame.current);

      const trigger = document.querySelector(
        `[data-legal-trigger="${live.current.docKey}"]`
      );

      const target =
        opener && document.contains(opener)
          ? opener
          : trigger;

      if (target && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
    };
  }, []);

  // Lock background-page scrolling while the modal is open.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    const previous = [
      root.style.overflow,
      body.style.overflow,
    ];

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      root.style.overflow = previous[0];
      body.style.overflow = previous[1];
    };
  }, []);

  // New document → top. Section link → target section and focus its heading.
  useEffect(() => {
    const body = bodyRef.current;

    if (!body) {
      return;
    }

    const initial = firstRun.current;
    firstRun.current = false;

    const behavior =
      initial || reduced
        ? "auto"
        : "smooth";

    const scrollTo = (top) => {
      if (typeof body.scrollTo === "function") {
        body.scrollTo({
          top,
          behavior,
        });
      } else {
        body.scrollTop = top;
      }
    };

    const target = sectionId
      ? body.querySelector(`[data-sec="${sectionId}"]`)
      : null;

    if (target) {
      // offsetTop may be relative to the section, not the scrolling element.
      // Compare element rectangles to calculate the correct scroll position.
      const bodyRect = body.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const targetTop =
        body.scrollTop +
        targetRect.top -
        bodyRect.top -
        12;

      scrollTo(Math.max(0, targetTop));

      if (!initial) {
        target.focus({ preventScroll: true });
      }
    } else {
      body.scrollTop = 0;
    }
  }, [
    docKey,
    sectionId,
    locationKey,
    reduced,
  ]);

  const onScroll = useCallback(() => {
    if (frame.current) {
      return;
    }

    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;

      const el = bodyRef.current;

      if (!el) {
        return;
      }

      const max = el.scrollHeight - el.clientHeight;

      if (barRef.current) {
        barRef.current.style.transform =
          `scaleX(${max > 0 ? Math.min(1, el.scrollTop / max) : 0})`;
      }

      const show = el.scrollTop > 520;

      setShowTop((prev) =>
        prev === show ? prev : show
      );
    });
  }, []);

  const onTabKey = (e, index) => {
    const n = LEGAL_KEYS.length;
    let next = null;

    if (
      e.key === "ArrowRight" ||
      e.key === "ArrowDown"
    ) {
      next = (index + 1) % n;
    } else if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowUp"
    ) {
      next = (index - 1 + n) % n;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = n - 1;
    }

    if (next === null) {
      return;
    }

    e.preventDefault();

    onSwitch(LEGAL_KEYS[next]);

    const node = tabRefs.current[next];

    if (node) {
      node.focus({ preventScroll: true });
    }
  };

  const toTop = () => {
    const body = bodyRef.current;

    if (!body) {
      return;
    }

    if (typeof body.scrollTo === "function") {
      body.scrollTo({
        top: 0,
        behavior: reduced ? "auto" : "smooth",
      });
    } else {
      body.scrollTop = 0;
    }

    body.focus({ preventScroll: true });
  };

  const dur = reduced ? 0.01 : 0.28;
  const ease = [0.22, 0.8, 0.24, 1];

  const metaParts = [
    `Version ${LEGAL.version}`,
    `Effective ${LEGAL.effective}`,
  ];

  if (
    LEGAL.updated &&
    LEGAL.updated !== LEGAL.effective
  ) {
    metaParts.push(`Updated ${LEGAL.updated}`);
  }

  return (
    <div className="arv-sheet">
      <motion.div
        className="arv-sheet__scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: reduced ? 0.01 : 0.2,
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        ref={panelRef}
        className="arv-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        initial={{
          opacity: 0,
          y: reduced ? 0 : 32,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        exit={{
          opacity: 0,
          y: reduced ? 0 : 20,
        }}
        transition={{
          duration: dur,
          ease,
        }}
      >
        <div
          className="arv-sheet__grab"
          aria-hidden="true"
        />

        <header className="arv-sheet__head">
          <div className="arv-sheet__titles">
            <h2
              id={`${uid}-title`}
              className="arv-sheet__title"
            >
              {doc.title}
            </h2>

            <p className="arv-sheet__meta">
              {metaParts.join(" · ")}
            </p>
          </div>

          <button
            type="button"
            className="arv-iconbtn"
            onClick={onClose}
            aria-label="Close legal documents"
          >
            <ArvdoulGlyph
              name="close"
              size={20}
              weight={2}
              gradient={false}
            />
          </button>
        </header>

        <div
          className="arv-tabs"
          role="tablist"
          aria-label="Legal documents"
        >
          {LEGAL_KEYS.map((k, i) => {
            const selected = docKey === k;

            return (
              <button
                key={k}
                ref={(node) => {
                  tabRefs.current[i] = node;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${k}`}
                aria-selected={selected}
                aria-controls={`${uid}-panel`}
                tabIndex={selected ? 0 : -1}
                className="arv-tab"
                onClick={() => {
                  if (!selected) {
                    onSwitch(k);
                  }
                }}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {LEGAL_TAB_LABEL[k]}
              </button>
            );
          })}
        </div>

        <div
          className="arv-progress"
          aria-hidden="true"
        >
          <span ref={barRef} />
        </div>

        <div className="arv-sheet__main">
          <div
            className="arv-sheet__body"
            ref={bodyRef}
            id={`${uid}-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-${docKey}`}
            tabIndex={0}
            onScroll={onScroll}
          >
            <div className="arv-doc">
              {!LEGAL.reviewed && (
                <p
                  className="arv-doc__draft"
                  role="note"
                >
                  Draft — this document is awaiting legal review and may change before launch.
                </p>
              )}

              <LegalDocument doc={doc} />

              <details
                className="arv-toc"
                ref={tocRef}
              >
                <summary>
                  <span>Jump to a section</span>

                  <ArvdoulGlyph
                    name="chevron"
                    size={18}
                    weight={2.2}
                    gradient={false}
                    className="arv-toc__chev"
                  />
                </summary>

                <ol>
                  {doc.sections.map((s) => (
                    <li key={s.id}>
                      <Link
                        replace
                        to={{
                          hash: `#${docKey}/${s.id}`,
                        }}
                        state={linkState}
                        onClick={() => {
                          if (tocRef.current) {
                            tocRef.current.open = false;
                          }
                        }}
                      >
                        {s.h}
                      </Link>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          </div>

          {showTop && (
            <button
              type="button"
              className="arv-top"
              onClick={toTop}
              aria-label="Back to top of document"
            >
              <ArvdoulGlyph
                name="up"
                size={20}
                weight={2.2}
                gradient={false}
              />
            </button>
          )}
        </div>

        <footer className="arv-sheet__foot">
          <p className="arv-sheet__note">
            Opening these documents does not create an account or record acceptance.
          </p>

          <button
            type="button"
            className="arv-btn arv-btn--primary arv-btn--compact"
            onClick={onClose}
          >
            <span>Done</span>
          </button>
        </footer>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════ main screen ═══════════════════════════════ */

function IntroScreen({
  redirectAuthenticated = true,
  showThemeToggle = true,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = Boolean(useReducedMotion());

  const themeCtx = useTheme() || {};

  const requestedTheme =
    themeCtx.resolvedTheme === "dark" ||
    themeCtx.resolvedTheme === "light"
      ? themeCtx.resolvedTheme
      : themeCtx.theme;

  const resolved = useResolvedTheme(requestedTheme);

  const {
    authInitialized,
    isAuthenticated,
  } = useAuth() || {};

  const nav = useAccountNavigation();

  const headingId = `arv${safeId(useId())}-h`;
  const shellRef = useRef(null);

  useThemeColorMeta(BG[resolved]);

  // Do not redirect before the authentication provider has initialised.
  useEffect(() => {
    if (
      redirectAuthenticated &&
      authInitialized &&
      isAuthenticated
    ) {
      navigate(ROUTES.home, {
        replace: true,
        state: { fromIntro: true },
      });
    }
  }, [
    redirectAuthenticated,
    authInitialized,
    isAuthenticated,
    navigate,
  ]);

  /*
   * LEGAL NAVIGATION CONTRACT
   *
   * Open from a footer link:
   *   push the legal hash so Back / Android Back can close the sheet.
   *
   * Switch documents:
   *   replace the existing sheet entry, so tab changes do not accumulate
   *   separate history entries.
   *
   * Section links:
   *   replace with #terms/<section> or #privacy/<section>.
   *
   * Direct load:
   *   /intro#terms and /intro#privacy remain supported.
   *
   * Close:
   *   pop only when the sheet was opened from this screen; otherwise clear
   *   the hash without blindly navigating away from a direct link.
   */

  const {
    key: legalKey,
    section: legalSection,
  } = parseLegalHash(location.hash);

  const openedHere = Boolean(
    location.state &&
    location.state.arvLegal
  );

  const legalKeyRef = useRef(legalKey);
  const closing = useRef(false);
  const closeTimer = useRef(0);

  legalKeyRef.current = legalKey;

  useEffect(() => {
    closing.current = false;
  }, [legalKey]);

  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  const closeLegal = useCallback(() => {
    if (
      closing.current ||
      !legalKeyRef.current
    ) {
      return;
    }

    closing.current = true;

    const idx =
      window.history.state &&
      typeof window.history.state.idx === "number"
        ? window.history.state.idx
        : null;

    const canPop =
      openedHere &&
      (idx === null || idx > 0);

    if (canPop) {
      navigate(-1);

      window.clearTimeout(closeTimer.current);

      closeTimer.current = window.setTimeout(() => {
        if (legalKeyRef.current) {
          navigate(
            { hash: "" },
            { replace: true }
          );
        }
      }, 500);
    } else {
      navigate(
        { hash: "" },
        { replace: true }
      );
    }
  }, [
    navigate,
    openedHere,
  ]);

  const switchLegal = useCallback(
    (key) => {
      if (!LEGAL_KEYS.includes(key)) {
        return;
      }

      navigate(
        { hash: `#${key}` },
        {
          replace: true,
          state: location.state,
        }
      );
    },
    [
      navigate,
      location.state,
    ]
  );

  // Make background content inert while the legal dialog is open.
  useEffect(() => {
    const el = shellRef.current;

    if (!el) {
      return undefined;
    }

    if (legalKey) {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    } else {
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    }

    return () => {
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    };
  }, [legalKey]);

  const {
    go,
    status,
    slow,
    locked,
    target,
  } = nav;

  const pendingText = slow
    ? "Taking longer than usual. Activate the button again to retry."
    : target
      ? `Opening ${target === "signup" ? "sign up" : "log in"}`
      : "";

  const errorText =
    status === "error"
      ? "Couldn’t open that page. Check your connection and try again."
      : "";

  const visibleNote =
    errorText ||
    (slow
      ? "Taking a bit longer than usual — tap again to retry."
      : "");

  return (
    <div
      className="arv-intro"
      data-theme={resolved}
    >
      <style>{CSS}</style>

      <div
        className="arv-shell"
        ref={shellRef}
      >
        {showThemeToggle && (
          <div className="arv-toggle">
            <ThemeToggle
              variant="icon"
              size="lg"
            />
          </div>
        )}

        <div className="arv-col">
          <header className="arv-brand">
            <div className="arv-brand__mark">
              <BrandMark />
            </div>

            <Wordmark />

            <p className="arv-descriptor">
              {COPY.descriptor}
            </p>
          </header>

          <main
            className="arv-main arv-rise"
            aria-labelledby={headingId}
          >
            <div className="arv-welcome">
              <h1
                id={headingId}
                className="arv-heading"
              >
                {COPY.heading}
              </h1>

              <p className="arv-support">
                {COPY.support}
              </p>
            </div>

            <div className="arv-panel arv-glass">
              <ul
                className="arv-features"
                aria-label="What you can do on Arvdoul"
              >
                {FEATURES.map(({ key, label }) => (
                  <li
                    key={key}
                    className="arv-feature"
                  >
                    <span
                      className="arv-chip"
                      aria-hidden="true"
                    >
                      <ArvdoulGlyph
                        name={key}
                        size={30}
                      />
                    </span>

                    <span className="arv-feature__label">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="arv-actions">
              <IntroActionButton
                variant="primary"
                label="Sign Up"
                pendingLabel="One sec…"
                arrow
                pending={target === "signup" && !slow}
                blocked={locked && target !== "signup"}
                onPress={() => go("signup")}
              />

              <IntroActionButton
                variant="secondary"
                label="Log In"
                pendingLabel="One sec…"
                pending={target === "login" && !slow}
                blocked={locked && target !== "login"}
                onPress={() => go("login")}
              />

              <p
                className="arv-sr"
                role="status"
                aria-live="polite"
              >
                {pendingText}
              </p>

              <p
                className="arv-sr"
                role="alert"
              >
                {errorText}
              </p>

              {visibleNote && (
                <p
                  className="arv-note"
                  aria-hidden="true"
                  data-tone={errorText ? "error" : "info"}
                >
                  {visibleNote}
                </p>
              )}
            </div>
          </main>

          <footer className="arv-footer arv-rise">
            <p className="arv-closing">
              {COPY.closing.map((part, i) => (
                <Fragment key={part}>
                  {i > 0 && " "}

                  <span className="arv-closing__part">
                    {part}

                    {i < COPY.closing.length - 1 && (
                      <span
                        className="arv-closing__dot"
                        aria-hidden="true"
                      >
                        {" ·"}
                      </span>
                    )}
                  </span>
                </Fragment>
              ))}
            </p>

            <nav
              className="arv-legal"
              aria-label="Legal"
            >
              <Link
                to={{ hash: "#terms" }}
                state={{ arvLegal: true }}
                className="arv-legal__link"
                data-legal-trigger="terms"
              >
                Terms of Service
              </Link>

              <span
                className="arv-legal__sep"
                aria-hidden="true"
              >
                ·
              </span>

              <Link
                to={{ hash: "#privacy" }}
                state={{ arvLegal: true }}
                className="arv-legal__link"
                data-legal-trigger="privacy"
              >
                Privacy Policy
              </Link>
            </nav>
          </footer>
        </div>
      </div>

      <AnimatePresence>
        {legalKey && (
          <LegalSheet
            key="legal"
            docKey={legalKey}
            sectionId={legalSection}
            onClose={closeLegal}
            onSwitch={switchLegal}
            linkState={location.state}
            locationKey={location.key}
            reduced={reduced}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════ error boundary ═══════════════════════════════ */

const isDevBuild = () => {
  try {
    return Boolean(
      import.meta.env &&
      import.meta.env.DEV
    );
  } catch {
    return false;
  }
};

// Dependency-free fallback. The anchors do not depend on React Router hooks.
function IntroFallback({ onRetry, error }) {
  const dark = systemIsDark();

  const fg = dark
    ? "#F6F8FC"
    : "#10162C";

  const sub = dark
    ? "#AAB7D3"
    : "#5B6783";

  const btn = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    height: 54,
    width: "100%",
    borderRadius: 999,
    font: "600 17px/1 Inter, system-ui, sans-serif",
    cursor: "pointer",
    textDecoration: "none",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: dark ? BG.dark : BG.light,
        color: fg,
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
        }}
      >
        <BrandMark
          style={{
            width: 88,
            height: 88,
            margin: "0 auto",
          }}
        />

        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            margin: "20px 0 8px",
          }}
        >
          Welcome to Arvdoul
        </h1>

        <p
          style={{
            color: sub,
            margin: "0 0 24px",
            fontSize: 15,
            lineHeight: 1.5,
          }}
        >
          Something went wrong loading this screen, but you can still continue.
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          <a
            href={ROUTES.signup}
            style={{
              ...btn,
              border: 0,
              color: "#fff",
              background: UI_GRADIENT,
            }}
          >
            Sign Up
          </a>

          <a
            href={ROUTES.login}
            style={{
              ...btn,
              color: fg,
              background: "transparent",
              border: "1.5px solid rgba(139,124,255,.7)",
            }}
          >
            Log In
          </a>

          <button
            type="button"
            onClick={onRetry}
            style={{
              background: "none",
              border: 0,
              color: sub,
              font: "500 14px Inter, system-ui, sans-serif",
              minHeight: 44,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>

        {isDevBuild() && error && (
          <pre
            style={{
              marginTop: 16,
              textAlign: "left",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: 12,
              color: sub,
            }}
          >
            {String(error.message || error)}
          </pre>
        )}
      </div>
    </div>
  );
}

class IntroErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      error: null,
      attempt: 0,
    };

    this.retry = () =>
      this.setState((s) => ({
        error: null,
        attempt: s.attempt + 1,
      }));
  }

  static getDerivedStateFromError(error) {
    if (typeof process !== 'undefined' && process.stderr) {
      process.stderr.write(`[Intro Error] ${error?.message}\n${error?.stack}\n`);
    }
    return {
      error: error || new Error("Unknown render error"),
    };
  }

  componentDidCatch(error, info) {
    if (typeof process !== 'undefined' && process.stderr) {
      process.stderr.write(`[Arvdoul Intro Catch] ${error?.message}\n${error?.stack}\n`);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <IntroFallback
          onRetry={this.retry}
          error={this.state.error}
        />
      );
    }

    return (
      <Fragment key={this.state.attempt}>
        {this.props.children}
      </Fragment>
    );
  }
}

export default function IntroScreenWrapper(props) {
  return (
    <IntroErrorBoundary>
      <IntroScreen {...props} />
    </IntroErrorBoundary>
  );
}

/* ═══════════════════════════════════ styles ═══════════════════════════════════ */

const CSS = `
.arv-intro{
  --arv-bg:${BG.dark};
  --arv-violet:${TOKENS.violet};
  --arv-indigo:${TOKENS.indigo};
  --arv-blue:${TOKENS.blue};
  --arv-brand:${UI_GRADIENT};

  --arv-tx1:#F6F8FC;
  --arv-tx2:#B3BFDA;
  --arv-tx3:#7887AB;
  --arv-doc:#D3DBEF;

  --arv-surface:rgba(255,255,255,.06);
  --arv-surface-2:rgba(255,255,255,.10);
  --arv-border:rgba(167,180,208,.20);
  --arv-border-strong:rgba(167,180,208,.34);

  --arv-focus:#B2A6FF;
  --arv-ring-solid:rgba(160,146,255,.62);

  --arv-icon-a:#DA9EFF;
  --arv-icon-b:#62B0FF;

  --arv-error:#FF8FA3;
  --arv-note:#B3BFDA;
  --arv-dot:#B58CFF;

  /*
   * DARK CRYSTAL
   * Deeper neutral-indigo glass with controlled transparency, a clearer rim,
   * restrained highlights and materially quieter shadows.
   *
   * The surface is not dependent on a purple/blue background glow. Its definition
   * comes from contrast, edge treatment and layered surface shading.
   */
  --arv-glass-fill:
    linear-gradient(
      150deg,
      rgba(39,49,82,.82) 0%,
      rgba(23,32,62,.88) 34%,
      rgba(15,23,49,.91) 70%,
      rgba(11,18,40,.94) 100%
    );

  --arv-glass-base:#10182F;

  --arv-glass-rim:rgba(160,177,224,.30);

  --arv-glass-edge:
    linear-gradient(
      145deg,
      rgba(239,244,255,.62) 0%,
      rgba(186,202,243,.24) 20%,
      rgba(132,151,203,.10) 55%,
      rgba(104,131,205,.38) 100%
    );

  --arv-glass-shadow:
    0 22px 40px -28px rgba(0,0,0,.94),
    0 3px 8px rgba(0,0,0,.34),
    inset 0 1px 0 rgba(255,255,255,.15),
    inset 0 -1px 0 rgba(133,155,220,.14),
    inset 0 -18px 26px -28px rgba(111,139,218,.36);

  --arv-sheen:
    radial-gradient(
      115% 75% at 12% -18%,
      rgba(255,255,255,.15) 0%,
      rgba(255,255,255,.045) 34%,
      rgba(255,255,255,0) 68%
    );

  --arv-chip-fill:
    linear-gradient(
      155deg,
      rgba(60,72,109,.74) 0%,
      rgba(30,41,75,.86) 52%,
      rgba(21,31,61,.92) 100%
    );

  --arv-chip-rim:rgba(177,193,233,.24);

  --arv-chip-shadow:
    inset 0 1px 0 rgba(255,255,255,.15),
    inset 0 -1px 0 rgba(120,147,210,.10),
    0 9px 18px -14px rgba(0,0,0,.70);

  --arv-btn2-fill:
    linear-gradient(
      155deg,
      rgba(36,46,80,.90) 0%,
      rgba(19,28,57,.94) 100%
    );

  --arv-btn2-fill-hover:
    linear-gradient(
      155deg,
      rgba(48,60,101,.94) 0%,
      rgba(25,36,70,.97) 100%
    );

  --arv-btn2-shadow:
    inset 0 1px 0 rgba(255,255,255,.13),
    inset 0 -1px 0 rgba(129,150,210,.10),
    0 10px 22px -17px rgba(0,0,0,.85);

  /* BRAND CRYSTAL — reserved for the primary action and selected states. */
  --arv-crystal:${UI_GRADIENT};

  --arv-crystal-edge:
    inset 0 1px 0 rgba(255,255,255,.38),
    inset 0 -3px 8px rgba(20,10,120,.32);

  --arv-btn-shadow:
    0 14px 28px -19px rgba(68,49,247,.78),
    0 4px 10px -6px rgba(5,91,251,.36);

  /*
   * Very subtle surface texture. It is not used as a page background.
   * The low alpha keeps dark glass clean rather than visibly grainy.
   */
  --arv-grain:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .045 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");

  --arv-sheet:#0A1030;
  --arv-scrim:rgba(1,3,12,.68);
  --arv-sheet-shadow:0 -20px 60px -20px rgba(0,0,0,.75);

  --arv-logo:clamp(76px,12vh,112px);
  --arv-word:clamp(150px,48vw,208px);

  color-scheme:dark;
  position:relative;
  isolation:isolate;
  width:100%;
  min-height:100vh;
  min-height:100dvh;
  color:var(--arv-tx1);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  -webkit-text-size-adjust:100%;
  text-size-adjust:100%;
  -webkit-tap-highlight-color:transparent;
  background:var(--arv-bg);
}

.arv-intro[data-theme="light"]{
  --arv-bg:${BG.light};

  --arv-tx1:#10162C;
  --arv-tx2:#56627E;
  --arv-tx3:#7C88A1;
  --arv-doc:#26304B;

  --arv-surface:rgba(16,22,44,.045);
  --arv-surface-2:rgba(16,22,44,.075);
  --arv-border:rgba(35,49,84,.14);
  --arv-border-strong:rgba(35,49,84,.28);

  --arv-focus:#4431F7;
  --arv-ring-solid:rgba(68,49,247,.55);

  --arv-icon-a:#8B1EF3;
  --arv-icon-b:#055BFB;

  --arv-error:#B4233F;
  --arv-note:#56627E;
  --arv-dot:#8B1EF3;

  /* LIGHT GLASS: clean white material against the canonical light background. */
  --arv-glass-fill:
    linear-gradient(
      150deg,
      rgba(255,255,255,.96) 0%,
      rgba(255,255,255,.84) 45%,
      rgba(248,250,255,.92) 100%
    );

  --arv-glass-base:#FFFFFF;

  --arv-glass-rim:rgba(35,49,84,.13);

  --arv-glass-edge:
    linear-gradient(
      145deg,
      rgba(255,255,255,1) 0%,
      rgba(255,255,255,.90) 22%,
      rgba(35,49,84,.10) 62%,
      rgba(68,49,247,.26) 100%
    );

  --arv-glass-shadow:
    0 22px 38px -29px rgba(35,49,84,.38),
    0 2px 5px rgba(16,22,44,.045),
    inset 0 1px 0 rgba(255,255,255,1),
    inset 0 -1px 0 rgba(35,49,84,.035);

  --arv-sheen:
    radial-gradient(
      115% 75% at 12% -18%,
      rgba(255,255,255,.96) 0%,
      rgba(255,255,255,.48) 32%,
      rgba(255,255,255,0) 68%
    );

  --arv-chip-fill:
    linear-gradient(
      155deg,
      #FFFFFF 0%,
      rgba(250,251,255,.98) 55%,
      rgba(239,243,255,.96) 100%
    );

  --arv-chip-rim:rgba(35,49,84,.13);

  --arv-chip-shadow:
    inset 0 1px 0 #FFFFFF,
    inset 0 -1px 0 rgba(35,49,84,.035),
    0 8px 16px -13px rgba(35,49,84,.32);

  --arv-btn2-fill:
    linear-gradient(
      155deg,
      rgba(255,255,255,.98) 0%,
      rgba(250,251,255,.94) 100%
    );

  --arv-btn2-fill-hover:
    linear-gradient(
      155deg,
      #FFFFFF 0%,
      rgba(245,247,255,.98) 100%
    );

  --arv-btn2-shadow:
    inset 0 1px 0 #FFFFFF,
    inset 0 -1px 0 rgba(35,49,84,.035),
    0 10px 20px -16px rgba(35,49,84,.28);

  --arv-btn-shadow:
    0 14px 26px -19px rgba(68,49,247,.56),
    0 4px 10px -6px rgba(5,91,251,.28);

  --arv-sheet:#FFFFFF;
  --arv-scrim:rgba(16,22,44,.42);
  --arv-sheet-shadow:0 -20px 60px -24px rgba(16,22,44,.32);

  color-scheme:light;
}

.arv-intro *,
.arv-intro *::before,
.arv-intro *::after{
  box-sizing:border-box;
}

.arv-sr{
  position:absolute;
  width:1px;
  height:1px;
  margin:-1px;
  padding:0;
  overflow:hidden;
  clip:rect(0 0 0 0);
  clip-path:inset(50%);
  white-space:nowrap;
  border:0;
}

/* Layout and safe areas. The page uses background tokens only. */
.arv-shell{
  position:relative;
  isolation:isolate;
  width:100%;
  min-height:100vh;
  min-height:100dvh;
  overflow-x:hidden;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  padding:
    calc(env(safe-area-inset-top,0px) + 20px)
    calc(env(safe-area-inset-right,0px) + 20px)
    calc(env(safe-area-inset-bottom,0px) + 12px)
    calc(env(safe-area-inset-left,0px) + 20px);
}

.arv-toggle{
  position:absolute;
  z-index:5;
  top:calc(env(safe-area-inset-top,0px) + 12px);
  right:calc(env(safe-area-inset-right,0px) + 12px);
}

/* Main composition. */
.arv-col{
  width:100%;
  max-width:440px;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  gap:clamp(16px,3vh,30px);
  padding-block:clamp(4px,1.2vh,16px);
}

.arv-brand{
  display:flex;
  flex-direction:column;
  align-items:center;
  text-align:center;
}

.arv-brand__mark{
  position:relative;
  isolation:isolate;
  width:var(--arv-logo);
  height:var(--arv-logo);
  margin-bottom:clamp(12px,2vh,20px);
  animation:arv-logo-in .5s cubic-bezier(.22,.8,.24,1) both;
}

/* No ambient halo behind the logo. Keep the master artwork itself unchanged. */
.arv-brand__mark svg{
  width:100%;
  height:100%;
}

.arv-word{
  position:relative;
  width:var(--arv-word);
  aspect-ratio:508 / 120;
}

.arv-word > svg{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  overflow:visible;
  display:block;
}

.arv-word[data-treatment="refined"] > svg{
  filter:drop-shadow(0 1.5px 1px rgba(38,16,126,.28));
}

.arv-descriptor{
  margin:clamp(8px,1.6vh,14px) 0 0;
  font-size:13px;
  line-height:1.3;
  font-weight:500;
  letter-spacing:.16em;
  margin-right:-.16em;
  color:var(--arv-tx2);
}

.arv-main{
  display:flex;
  flex-direction:column;
  gap:clamp(16px,2.8vh,26px);
}

.arv-welcome{
  text-align:center;
}

.arv-heading{
  margin:0;
  font-size:clamp(27px,4.4vh,38px);
  line-height:1.15;
  font-weight:700;
  letter-spacing:-.025em;
  color:var(--arv-tx1);
  text-wrap:balance;
  overflow-wrap:anywhere;
}

.arv-support{
  margin:10px auto 0;
  max-width:30ch;
  font-size:16.5px;
  line-height:1.5;
  font-weight:450;
  color:var(--arv-tx2);
  text-wrap:balance;
}

/* The complete wordmark is the rendered artwork. */
.arv-pen{
  animation:arv-write .42s cubic-bezier(.4,0,.2,1) calc(.2s + var(--i) * .07s) both;
}

@keyframes arv-write{
  0%{
    stroke-dasharray:1 1;
    stroke-dashoffset:1;
    opacity:0;
  }
  8%{
    opacity:1;
  }
  100%{
    stroke-dasharray:1 1;
    stroke-dashoffset:0;
    opacity:1;
  }
}

/*
 * GLASS MATERIAL
 *
 * The normal background stack has a base-colour fallback.
 * Where backdrop-filter is supported, the layered translucent fill is preserved
 * so the surface retains depth without relying on page-level ambient glow.
 */
.arv-glass{
  position:relative;
  isolation:isolate;
  border:1px solid var(--arv-glass-rim);
  border-radius:30px;
  box-shadow:var(--arv-glass-shadow);
  background:
    var(--arv-sheen),
    var(--arv-glass-fill),
    var(--arv-grain),
    var(--arv-glass-base);
  background-size:
    100% 100%,
    100% 100%,
    120px 120px,
    100% 100%;
  background-repeat:
    no-repeat,
    no-repeat,
    repeat,
    no-repeat;
}

@supports (
  (-webkit-backdrop-filter:blur(1px)) or
  (backdrop-filter:blur(1px))
){
  .arv-glass{
    background:
      var(--arv-sheen),
      var(--arv-glass-fill),
      var(--arv-grain);
    background-size:
      100% 100%,
      100% 100%,
      120px 120px;
    background-repeat:
      no-repeat,
      no-repeat,
      repeat;

    -webkit-backdrop-filter:blur(18px) saturate(1.18);
    backdrop-filter:blur(18px) saturate(1.18);
  }
}

/* Gradient rim: thin and defined rather than a large luminous outline. */
@supports (
  (-webkit-mask-composite:xor) or
  (mask-composite:exclude)
){
  .arv-glass{
    border-color:transparent;
  }

  .arv-glass::before{
    content:"";
    position:absolute;
    inset:-1px;
    border-radius:inherit;
    padding:1px;
    pointer-events:none;
    background:var(--arv-glass-edge);

    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;

    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite:exclude;
  }
}

/* Honour reduced-transparency preferences when supported by the browser. */
@media (prefers-reduced-transparency:reduce){
  .arv-glass{
    background:
      var(--arv-glass-fill),
      var(--arv-glass-base) !important;
    background-size:100% 100% !important;
    -webkit-backdrop-filter:none !important;
    backdrop-filter:none !important;
  }

  .arv-btn--secondary{
    -webkit-backdrop-filter:none !important;
    backdrop-filter:none !important;
  }
}

/* Feature panel and icon chips. */
.arv-panel{
  padding:20px 12px 16px;
  border-radius:30px;
}

.arv-features{
  list-style:none;
  margin:0;
  padding:0;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  row-gap:clamp(14px,2.2vh,20px);
  column-gap:6px;
}

.arv-feature{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:10px;
  text-align:center;
  min-width:0;
}

.arv-chip{
  position:relative;
  display:grid;
  place-items:center;
  flex:none;
  width:56px;
  height:56px;
  border-radius:18px;
  background:var(--arv-chip-fill);
  border:1px solid var(--arv-chip-rim);
  box-shadow:var(--arv-chip-shadow);
}

.arv-chip svg{
  display:block;
}

.arv-feature__label{
  max-width:100%;
  font-size:13px;
  line-height:1.25;
  font-weight:550;
  letter-spacing:.005em;
  color:var(--arv-tx1);
  opacity:.92;
  overflow-wrap:anywhere;
}

/* Buttons: shared height, hierarchy, focus and state rules. */
.arv-actions{
  position:relative;
  display:grid;
  gap:12px;
}

.arv-btn{
  position:relative;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  width:100%;
  min-width:0;
  height:58px;
  padding:0 24px;
  border:1px solid transparent;
  border-radius:999px;
  font:inherit;
  font-size:17px;
  line-height:1.1;
  font-weight:650;
  letter-spacing:.005em;
  cursor:pointer;
  -webkit-user-select:none;
  user-select:none;
  touch-action:manipulation;
  text-decoration:none;

  transition:
    transform 140ms ease,
    box-shadow 220ms ease,
    filter 160ms ease,
    background 160ms ease;
}

.arv-btn--chip{
  padding:0 60px;
}

.arv-btn:focus-visible{
  outline:2px solid var(--arv-focus);
  outline-offset:3px;
}

.arv-btn:active:not([aria-disabled="true"]){
  transform:scale(.985);
}

.arv-btn > *{
  position:relative;
  z-index:1;
}

.arv-btn > .arv-btn__chip{
  position:absolute;
  right:6px;
  top:50%;
  margin-top:-22px;
}

.arv-btn svg{
  flex:none;
}

.arv-btn[aria-disabled="true"]{
  cursor:default;
}

.arv-btn[data-state="blocked"]{
  filter:saturate(.55) brightness(.92);
}

.arv-btn[data-state="pending"]{
  cursor:progress;
}

.arv-btn--compact{
  height:50px;
  font-size:16px;
}

.arv-btn__chip{
  display:grid;
  place-items:center;
  width:44px;
  height:44px;
  border-radius:50%;
  background:rgba(255,255,255,.20);
  border:1px solid rgba(255,255,255,.32);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.4);
  transition:
    transform 200ms ease,
    background-color 160ms ease;
}

/* Primary brand button. */
.arv-btn--primary{
  color:#FFFFFF;
  background:var(--arv-crystal);
  box-shadow:
    var(--arv-crystal-edge),
    var(--arv-btn-shadow);
}

.arv-btn--primary::before{
  content:"";
  position:absolute;
  left:1px;
  right:1px;
  top:1px;
  height:52%;
  z-index:0;
  pointer-events:none;
  border-radius:999px 999px 50% 50% / 999px 999px 40% 40%;
  background:
    linear-gradient(
      180deg,
      rgba(255,255,255,.27),
      rgba(255,255,255,.025)
    );
}

.arv-btn--primary:active:not([aria-disabled="true"]){
  filter:brightness(.94);
}

/* Secondary glass button. */
.arv-btn--secondary{
  color:var(--arv-tx1);
  background:var(--arv-btn2-fill);
  border-color:var(--arv-ring-solid);
  box-shadow:var(--arv-btn2-shadow);

  -webkit-backdrop-filter:blur(12px) saturate(1.14);
  backdrop-filter:blur(12px) saturate(1.14);
}

.arv-btn--secondary .arv-btn__chip{
  background:var(--arv-surface-2);
  border-color:var(--arv-border);
  box-shadow:none;
  color:var(--arv-tx1);
}

.arv-btn--secondary:active:not([aria-disabled="true"]){
  background:var(--arv-btn2-fill-hover);
}

.arv-btn--secondary[data-state="blocked"]{
  color:var(--arv-tx2);
}

@supports (
  (-webkit-mask-composite:xor) or
  (mask-composite:exclude)
){
  .arv-btn--secondary{
    border-color:transparent;
  }

  .arv-btn--secondary::before{
    content:"";
    position:absolute;
    inset:-1px;
    border-radius:inherit;
    padding:1.5px;
    pointer-events:none;
    background:var(--arv-brand);

    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;

    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite:exclude;
  }
}

@media (hover:hover){
  .arv-btn--primary:hover:not([aria-disabled="true"]){
    filter:brightness(1.06);
  }

  .arv-btn--primary:hover:not([aria-disabled="true"]) .arv-btn__chip{
    transform:translateX(2px);
    background:rgba(255,255,255,.28);
  }

  .arv-btn--secondary:hover:not([aria-disabled="true"]){
    background:var(--arv-btn2-fill-hover);
  }
}

.arv-spinner{
  width:18px;
  height:18px;
  border-radius:50%;
  border:2px solid currentColor;
  border-right-color:transparent;
  animation:arv-spin .8s linear infinite;
}

.arv-btn--primary .arv-spinner{
  color:#FFFFFF;
}

.arv-note{
  margin:2px 0 0;
  text-align:center;
  font-size:13.5px;
  line-height:1.4;
  color:var(--arv-note);
}

.arv-note[data-tone="error"]{
  color:var(--arv-error);
  font-weight:500;
}

/* Footer. */
.arv-footer{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:2px;
  text-align:center;
}

.arv-closing{
  margin:0;
  font-size:13.5px;
  line-height:1.5;
  font-weight:450;
  color:var(--arv-tx2);
  text-wrap:balance;
}

.arv-closing__part{
  white-space:nowrap;
}

.arv-closing__dot{
  color:var(--arv-dot);
  font-weight:700;
}

.arv-legal{
  display:flex;
  align-items:center;
  justify-content:center;
  flex-wrap:wrap;
  column-gap:4px;
}

.arv-legal__link{
  display:inline-flex;
  align-items:center;
  min-height:44px;
  padding:0 10px;
  border-radius:10px;
  font-size:13px;
  line-height:1.5;
  font-weight:500;
  color:var(--arv-tx2);
  text-decoration:underline;
  text-decoration-color:transparent;
  text-underline-offset:3px;
  transition:
    color 140ms ease,
    text-decoration-color 140ms ease;
}

.arv-legal__link:hover{
  color:var(--arv-tx1);
  text-decoration-color:currentColor;
}

.arv-legal__link:focus-visible{
  outline:2px solid var(--arv-focus);
  outline-offset:1px;
  color:var(--arv-tx1);
  text-decoration-color:currentColor;
}

.arv-legal__sep{
  color:var(--arv-tx3);
}

/* Legal sheet: opaque, readable surface. */
.arv-sheet{
  position:fixed;
  inset:0;
  z-index:100;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  padding-inline:
    env(safe-area-inset-left,0px)
    env(safe-area-inset-right,0px);
}

.arv-sheet__scrim{
  position:absolute;
  inset:0;
  background:var(--arv-scrim);
}

.arv-sheet__panel{
  position:relative;
  width:100%;
  max-width:640px;
  max-height:92vh;
  max-height:92dvh;
  display:flex;
  flex-direction:column;
  background:var(--arv-sheet);
  color:var(--arv-tx1);
  border:1px solid var(--arv-border);
  border-bottom:0;
  border-radius:28px 28px 0 0;
  box-shadow:
    var(--arv-sheet-shadow),
    inset 0 1px 0 rgba(255,255,255,.06);
  overflow:hidden;
}

.arv-sheet__panel::before{
  content:"";
  position:absolute;
  left:12%;
  right:12%;
  top:0;
  height:1px;
  background:
    linear-gradient(
      90deg,
      transparent,
      var(--arv-icon-a),
      var(--arv-icon-b),
      transparent
    );
  opacity:.55;
  pointer-events:none;
}

.arv-sheet__grab{
  width:40px;
  height:4px;
  border-radius:99px;
  background:var(--arv-border-strong);
  margin:10px auto 0;
  flex:none;
}

.arv-sheet__head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  padding:10px 12px 8px 20px;
  flex:none;
}

.arv-sheet__titles{
  min-width:0;
  padding-top:4px;
}

.arv-sheet__title{
  margin:0;
  font-size:20px;
  line-height:1.25;
  font-weight:700;
  letter-spacing:-.01em;
}

.arv-sheet__meta{
  margin:3px 0 0;
  font-size:12.5px;
  line-height:1.4;
  color:var(--arv-tx2);
}

.arv-tabs{
  display:flex;
  flex:none;
  gap:4px;
  margin:4px 20px 12px;
  padding:4px;
  border-radius:999px;
  background:var(--arv-surface);
  border:1px solid var(--arv-border);
}

.arv-tab{
  flex:1 1 0;
  min-width:0;
  min-height:40px;
  padding:0 16px;
  border:0;
  border-radius:999px;
  background:transparent;
  color:var(--arv-tx2);
  font:inherit;
  font-size:14.5px;
  font-weight:600;
  cursor:pointer;

  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.arv-tab[aria-selected="true"]{
  background:var(--arv-crystal);
  color:#FFFFFF;
  box-shadow:var(--arv-crystal-edge);
  font-weight:700;
}

.arv-tab:not([aria-selected="true"]):hover{
  color:var(--arv-tx1);
}

.arv-tab:active{
  transform:scale(.985);
}

.arv-tab:focus-visible,
.arv-iconbtn:focus-visible,
.arv-top:focus-visible,
.arv-sheet__body:focus-visible,
.arv-toc summary:focus-visible,
.arv-toc a:focus-visible{
  outline:2px solid var(--arv-focus);
  outline-offset:2px;
}

.arv-iconbtn{
  display:grid;
  place-items:center;
  flex:none;
  width:44px;
  height:44px;
  border-radius:50%;
  border:1px solid var(--arv-border);
  background:var(--arv-surface);
  color:var(--arv-tx1);
  cursor:pointer;
  transition:background-color 140ms ease;
}

.arv-iconbtn:hover{
  background:var(--arv-surface-2);
}

.arv-iconbtn:active{
  transform:scale(.96);
}

.arv-progress{
  flex:none;
  height:2px;
  background:var(--arv-border);
}

.arv-progress span{
  display:block;
  width:100%;
  height:100%;
  background:var(--arv-brand);
  transform-origin:0 50%;
  transform:scaleX(0);
}

.arv-sheet__main{
  position:relative;
  flex:1 1 auto;
  min-height:0;
  display:flex;
  flex-direction:column;
}

.arv-sheet__body{
  position:relative;
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  padding:16px 22px 28px;
}

.arv-doc{
  max-width:68ch;
  margin-inline:auto;
}

.arv-doc__draft{
  margin:0 0 14px;
  padding:10px 14px;
  border-radius:12px;
  border:1px solid var(--arv-border-strong);
  background:var(--arv-surface);
  font-size:13.5px;
  line-height:1.5;
  color:var(--arv-tx1);
}

.arv-doc__intro{
  margin:0 0 6px;
  font-size:16px;
  line-height:1.65;
  color:var(--arv-doc);
}

.arv-doc__section h3{
  margin:26px 0 8px;
  font-size:17px;
  line-height:1.35;
  font-weight:650;
  color:var(--arv-tx1);
  scroll-margin-top:12px;
}

.arv-doc__section h3:focus{
  outline:none;
}

.arv-doc__section h3:focus-visible{
  outline:2px solid var(--arv-focus);
  outline-offset:3px;
  border-radius:4px;
}

.arv-doc__section p{
  margin:0 0 12px;
  font-size:15.5px;
  line-height:1.7;
  color:var(--arv-doc);
}

.arv-doc__section ul{
  margin:0 0 12px;
  padding-left:22px;
  font-size:15.5px;
  line-height:1.7;
  color:var(--arv-doc);
}

.arv-doc__section li{
  margin-bottom:6px;
}

.arv-doc__section li::marker{
  color:var(--arv-icon-b);
}

.arv-toc{
  margin:28px 0 0;
  border:1px solid var(--arv-border);
  border-radius:16px;
  background:var(--arv-surface);
}

.arv-toc summary{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  min-height:48px;
  padding:0 16px;
  cursor:pointer;
  font-size:15px;
  font-weight:600;
  list-style:none;
}

.arv-toc summary::-webkit-details-marker{
  display:none;
}

.arv-toc[open] .arv-toc__chev{
  transform:rotate(180deg);
}

.arv-toc__chev{
  transition:transform 160ms ease;
}

.arv-toc ol{
  margin:0;
  padding:2px 12px 12px 40px;
  font-size:15px;
}

.arv-toc li{
  padding-left:2px;
}

.arv-toc a{
  display:flex;
  align-items:center;
  min-height:42px;
  color:var(--arv-tx2);
  text-decoration:none;
  border-radius:8px;
}

.arv-toc a:hover{
  color:var(--arv-tx1);
  text-decoration:underline;
  text-underline-offset:3px;
}

.arv-top{
  position:absolute;
  right:16px;
  bottom:14px;
  display:grid;
  place-items:center;
  width:44px;
  height:44px;
  border-radius:50%;
  border:1px solid var(--arv-border-strong);
  background:var(--arv-sheet);
  color:var(--arv-tx1);
  cursor:pointer;
  box-shadow:0 8px 18px -8px rgba(0,0,0,.35);
}

.arv-sheet__foot{
  flex:none;
  display:grid;
  gap:10px;
  padding:
    12px
    20px
    calc(env(safe-area-inset-bottom,0px) + 14px);
  border-top:1px solid var(--arv-border);
  background:var(--arv-sheet);
}

.arv-sheet__note{
  margin:0;
  text-align:center;
  font-size:12.5px;
  line-height:1.4;
  color:var(--arv-tx2);
}

@media (min-width:640px){
  .arv-sheet{
    align-items:center;
    padding:24px;
  }

  .arv-sheet__panel{
    border-radius:26px;
    border-bottom:1px solid var(--arv-border);
    max-height:min(86vh,780px);
    max-height:min(86dvh,780px);
  }

  .arv-sheet__grab{
    display:none;
  }

  .arv-sheet__head{
    padding:20px 20px 8px 28px;
  }

  .arv-tabs{
    margin-inline:28px;
  }

  .arv-sheet__body{
    padding-inline:28px;
  }

  .arv-sheet__foot{
    padding-inline:28px;
    padding-bottom:18px;
    grid-template-columns:1fr auto;
    align-items:center;
  }

  .arv-sheet__foot .arv-btn{
    width:auto;
    min-width:140px;
  }

  .arv-sheet__note{
    text-align:left;
  }
}

/* Entrance animation. No background animation or background glow. */
.arv-rise{
  animation:arv-rise .5s cubic-bezier(.22,.8,.24,1) .3s both;
}

@keyframes arv-rise{
  from{
    opacity:0;
    transform:translate3d(0,8px,0);
  }
  to{
    opacity:1;
    transform:none;
  }
}

@keyframes arv-logo-in{
  from{
    opacity:0;
    transform:scale(.96);
  }
  to{
    opacity:1;
    transform:none;
  }
}

@keyframes arv-spin{
  to{
    transform:rotate(360deg);
  }
}

/* Tablets and desktops. */
@media (min-width:768px) and (min-height:700px){
  .arv-intro{
    --arv-logo:116px;
    --arv-word:224px;
  }

  .arv-col{
    max-width:480px;
  }

  .arv-support{
    font-size:17.5px;
  }

  .arv-panel{
    padding:24px 16px 20px;
  }

  .arv-chip{
    width:60px;
    height:60px;
    border-radius:20px;
  }
}

@media (min-width:1200px) and (min-height:820px){
  .arv-intro{
    --arv-logo:124px;
    --arv-word:240px;
  }

  .arv-col{
    max-width:500px;
  }
}

/* Short portrait phones. */
@media (max-height:700px){
  .arv-panel{
    padding:14px 10px 12px;
  }

  .arv-chip{
    width:48px;
    height:48px;
    border-radius:16px;
  }

  .arv-feature{
    gap:7px;
  }
}

@media (max-height:640px){
  .arv-intro{
    --arv-logo:68px;
    --arv-word:150px;
  }

  .arv-support{
    max-width:none;
  }

  .arv-btn{
    height:54px;
  }

  .arv-btn > .arv-btn__chip{
    margin-top:-20px;
    width:40px;
    height:40px;
  }

  .arv-btn--chip{
    padding:0 56px;
  }

  .arv-btn--compact{
    height:50px;
  }
}

/* Narrow phones. */
@media (max-width:360px){
  .arv-shell{
    padding-inline:
      calc(env(safe-area-inset-left,0px) + 14px)
      calc(env(safe-area-inset-right,0px) + 14px);
  }

  .arv-panel{
    padding-inline:6px;
  }

  .arv-chip{
    width:50px;
    height:50px;
    border-radius:16px;
  }

  .arv-feature__label{
    font-size:12.5px;
  }

  .arv-btn{
    font-size:16px;
  }
}

/* Landscape phones: brand left, actions right. */
@media (orientation:landscape) and (max-height:560px) and (min-width:640px){
  .arv-col{
    max-width:880px;
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);
    grid-template-areas:"brand main" "brand foot";
    column-gap:clamp(32px,6vw,72px);
    row-gap:8px;
    align-content:center;
    align-items:center;
  }

  .arv-brand{
    grid-area:brand;
  }

  .arv-main{
    grid-area:main;
    gap:12px;
  }

  .arv-footer{
    grid-area:foot;
  }

  .arv-heading{
    font-size:26px;
  }

  .arv-support{
    font-size:15px;
    margin-top:6px;
  }

  .arv-panel{
    padding:10px 8px;
    border-radius:22px;
  }

  .arv-features{
    grid-template-columns:repeat(6,minmax(0,1fr));
    column-gap:0;
  }

  .arv-feature{
    gap:5px;
  }

  .arv-chip{
    width:40px;
    height:40px;
    border-radius:13px;
  }

  .arv-chip svg{
    width:22px;
    height:22px;
  }

  .arv-feature__label{
    font-size:11.5px;
    white-space:nowrap;
  }

  .arv-btn{
    height:48px;
    font-size:16px;
  }

  .arv-btn > .arv-btn__chip{
    margin-top:-18px;
    width:36px;
    height:36px;
  }

  .arv-btn--chip{
    padding:0 48px;
  }

  .arv-actions{
    grid-template-columns:1fr 1fr;
  }

  .arv-note{
    grid-column:1 / -1;
  }

  .arv-sheet__panel{
    max-height:calc(100vh - 12px);
    max-height:calc(100dvh - 12px);
  }

  .arv-sheet__grab{
    display:none;
  }
}

@media (max-height:480px){
  .arv-sheet__panel{
    max-height:100vh;
    max-height:100dvh;
    border-radius:16px 16px 0 0;
  }
}

/* Windows high-contrast / forced-colour mode. */
@media (forced-colors:active){
  .arv-btn{
    border:2px solid ButtonText;
    forced-color-adjust:none;
    background:ButtonFace;
    color:ButtonText;
  }

  .arv-btn::before{
    display:none;
  }

  .arv-glass{
    border:1px solid CanvasText;
    background:Canvas;
  }

  .arv-glass::before{
    display:none;
  }

  .arv-tab[aria-selected="true"]{
    outline:2px solid Highlight;
    forced-color-adjust:none;
  }
}

/* Reduced motion: retain the finished design and remove nonessential movement. */
@media (prefers-reduced-motion:reduce){
  .arv-rise,
  .arv-brand__mark,
  .arv-pen{
    animation:none !important;
  }

  .arv-btn,
  .arv-btn__chip,
  .arv-tab,
  .arv-iconbtn,
  .arv-toc__chev,
  .arv-legal__link{
    transition:none !important;
  }

  .arv-btn:active:not([aria-disabled="true"]),
  .arv-tab:active,
  .arv-iconbtn:active{
    transform:none;
  }

  .arv-btn--primary:hover:not([aria-disabled="true"]) .arv-btn__chip{
    transform:none;
  }

  .arv-spinner{
    animation:none;
    border-style:dotted;
    border-right-color:currentColor;
  }
}
`;