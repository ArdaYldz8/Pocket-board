'use client';

import { ReactNode } from 'react';
import { LanguageProvider } from '@/lib/LanguageContext';

export function ClientProviders({ children }: { children: ReactNode }) {
    return (
        <LanguageProvider>
            {children}
        </LanguageProvider>
    );
}
