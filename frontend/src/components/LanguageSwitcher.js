import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaGlobe } from 'react-icons/fa';
import '../styles/LanguageSwitcher.css';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleChange = (e) => {
    const lng = e.target.value;
    i18n.changeLanguage(lng);
    // also update <html lang> for a11y / SEO
    document.documentElement.lang = lng;
  };

  // i18n.language can be like "en-US", normalize to base
  const current = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  return (
    <div className="lang-switcher" title={t('common.language')}>
      <FaGlobe className="lang-icon" aria-hidden="true" />
      <select
        aria-label={t('common.language')}
        value={current}
        onChange={handleChange}
        className="lang-select"
      >
        <option value="en">{t('common.english')}</option>
        <option value="zh">{t('common.chinese')}</option>
      </select>
    </div>
  );
}

export default LanguageSwitcher;
