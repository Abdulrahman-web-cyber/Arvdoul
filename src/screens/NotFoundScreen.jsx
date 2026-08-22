import React from 'react';
import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '../design-system/Button.jsx';

/**
 * ARVDOUL 404 SCREEN — design-system backed, i18n-ready, accessible.
 * role="main" + visible focus ring + translated strings.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950 text-white flex flex-col items-center justify-center px-6"
      role="main"
      aria-labelledby="not-found-title"
    >
      <h1
        id="not-found-title"
        className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 mb-4"
      >
        404
      </h1>
      <h2 className="text-2xl font-bold mb-2">{t('notFound.title')}</h2>
      <p className="text-white/60 mb-8 text-center max-w-md">{t('notFound.description')}</p>
      <Link to="/home" aria-label={t('notFound.goHome')}>
        <Button variant="primary" size="lg">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          {t('notFound.goHome')}
          <Compass className="w-4 h-4 opacity-70" aria-hidden="true" />
        </Button>
      </Link>
    </div>
  );
}
