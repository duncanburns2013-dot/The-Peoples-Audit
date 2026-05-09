import { useCallback, useEffect, useState } from 'react';

/**
 * Tiny hook that mirrors a piece of state into the URL's query string,
 * so users can share filtered views via copy-paste.
 *
 *   const [year, setYear] = useUrlState('year', '2026');
 *   const [tab,  setTab]  = useUrlState('tab',  'spending');
 *
 * Multiple useUrlState hooks coexist on the same page — each owns one key.
 *
 * Notes:
 *   - Strings only. JSON-encode if you need objects.
 *   - Uses replaceState by default (no history spam). Pass { push: true } to
 *     append a history entry instead.
 *   - Listens to popstate so back/forward buttons update React state.
 */
export function useUrlState(key, defaultValue, { push = false } = {}) {
  const read = useCallback(() => {
    if (typeof window === 'undefined') return defaultValue;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(key);
    return raw === null ? defaultValue : raw;
  }, [key, defaultValue]);

  const [value, setValue] = useState(read);

  // Sync to URL whenever value changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get(key);

    if (value === defaultValue || value === null || value === undefined || value === '') {
      if (current === null) return;
      params.delete(key);
    } else {
      const str = String(value);
      if (current === str) return;
      params.set(key, str);
    }

    const qs = params.toString();
    const newUrl =
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;

    if (push) {
      window.history.pushState(null, '', newUrl);
    } else {
      window.history.replaceState(null, '', newUrl);
    }
  }, [key, value, defaultValue, push]);

  // Sync from URL when the user hits back/forward.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => setValue(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [read]);

  return [value, setValue];
}
