'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handleChange = () => setMatches(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener('change', handleChange);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, [query]);

    return matches;
}
