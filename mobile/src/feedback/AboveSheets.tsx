import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

// iOS draws sheets above the whole app, this layer goes above them too.
// Android already draws messages above sheets
export function AboveSheets({ children }: { children: ReactNode }) {
	if (Platform.OS !== 'ios') return <>{children}</>;
	return <FullWindowOverlay>{children}</FullWindowOverlay>;
}
