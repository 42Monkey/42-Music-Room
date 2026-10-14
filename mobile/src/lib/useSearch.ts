import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_LETTERS = 2;
const PAUSE_MS = 350;

// Search as you type: runs once typing pauses, ignores late answers
// `find` must keep the same identity between renders (useCallback)
export function useSearch<T>(find: (words: string) => Promise<T[]>) {
	const [text, setText] = useState('');
	const [results, setResults] = useState<T[]>([]);
	const [searched, setSearched] = useState('');
	const [searching, setSearching] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const latest = useRef(0);
	const words = text.trim();
	const tooShort = words.length < MIN_LETTERS;

	const run = useCallback(
		async (query: string) => {
			const id = ++latest.current;
			setSearching(true);
			setError(null);
			try {
				const found = await find(query);
				if (id !== latest.current) return;
				setResults(found);
				setSearched(query);
			} catch (err) {
				if (id === latest.current) setError(err);
			} finally {
				if (id === latest.current) setSearching(false);
			}
		},
		[find],
	);

	useEffect(() => {
		if (tooShort) {
			latest.current += 1;
			setResults([]);
			setSearched('');
			setSearching(false);
			setError(null);
			return;
		}
		const timer = setTimeout(() => run(words), PAUSE_MS);
		return () => clearTimeout(timer);
	}, [words, tooShort, run]);

	const searchNow = useCallback(() => {
		if (!tooShort) run(words);
	}, [tooShort, run, words]);

	return { text, setText, results, searched, searching, error, tooShort, searchNow };
}
