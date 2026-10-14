// Colours, spacing and type sizes shared by every screen
export const colors = {
	background: '#F2F3F7',
	surface: '#FFFFFF',
	ink: '#1D1B34',
	muted: '#6C6A87',
	line: '#DEDFE8',
	accent: '#E0306A',
	accentPressed: '#C2245A',
	accentSoft: '#FCE8EF',
	accentText: '#A81E4E',
	live: '#169C6B',
	liveSoft: '#E3F4EC',
	danger: '#C8323A',
	dangerSoft: '#FBEAEB',
	warning: '#D98E12',
	overlay: 'rgba(29, 27, 52, 0.45)',
};

export const space = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
	huge: 48,
};

export const radius = {
	control: 14,
	card: 18,
	pill: 999,
};

// System font (SF Pro / Roboto), personality from size and weight
export const type = {
	largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -0.6 },
	title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
	headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
	body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
	callout: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
	caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
} as const;
