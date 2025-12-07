'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import trTranslations from '@/locales/tr.json';
import enTranslations from '@/locales/en.json';

type Language = 'tr' | 'en';
type Translations = typeof trTranslations;

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
    translations: Translations;
}

const translations: Record<Language, Translations> = {
    tr: trTranslations,
    en: enTranslations,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('tr');

    useEffect(() => {
        // Load saved language preference from localStorage
        const savedLang = localStorage.getItem('pocket-board-language') as Language;
        if (savedLang && (savedLang === 'tr' || savedLang === 'en')) {
            setLanguageState(savedLang);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('pocket-board-language', lang);
    };

    // Translation function - supports nested keys like "common.login"
    const t = (key: string): string => {
        const keys = key.split('.');
        let result: any = translations[language];

        for (const k of keys) {
            if (result && typeof result === 'object' && k in result) {
                result = result[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key; // Return the key itself if not found
            }
        }

        return typeof result === 'string' ? result : key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, translations: translations[language] }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

// Language switcher component
export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <button
            onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-sm font-medium"
        >
            <span className="text-lg">{language === 'tr' ? '🇹🇷' : '🇬🇧'}</span>
            <span className="text-slate-200">{language === 'tr' ? 'TR' : 'EN'}</span>
        </button>
    );
}
