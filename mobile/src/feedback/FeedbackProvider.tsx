import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Linking, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { describeError } from './describeError';
import { Dialog, type DialogOptions } from './Dialog';
import { Toast, type ToastData, type ToastKind } from './Toast';

const TOAST_MS = 4000;

type ShowErrorOptions = {
	as?: 'dialog' | 'toast';
	onRetry?: () => void;
};

type Feedback = {
	toast: (message: string, kind?: ToastKind) => void;
	dialog: (options: DialogOptions) => void;
	showError: (error: unknown, options?: ShowErrorOptions) => void;
};

const FeedbackContext = createContext<Feedback | null>(null);

// Toasts and dialogs, available to every screen
export function FeedbackProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastData | null>(null);
	const [dialogs, setDialogs] = useState<DialogOptions[]>([]);
	const nextId = useRef(0);

	const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
		nextId.current += 1;
		setToast({ id: nextId.current, message, kind });
	}, []);

	// Auto hide, restarted for each new toast
	useEffect(() => {
		if (!toast) return;
		const timer = setTimeout(() => setToast(null), TOAST_MS);
		return () => clearTimeout(timer);
	}, [toast]);

	// Dialogs wait in line, one at a time
	const showDialog = useCallback((options: DialogOptions) => {
		setDialogs((queue) => [...queue, options]);
	}, []);

	const closeDialog = useCallback(() => setDialogs((queue) => queue.slice(1)), []);

	// Picks the right buttons for what the user can do next
	const showError = useCallback(
		(error: unknown, options: ShowErrorOptions = {}) => {
			const described = describeError(error);
			if (options.as === 'toast') {
				showToast(described.message, 'error');
				return;
			}
			const close = { label: 'Close' };
			if (described.action === 'settings') {
				showDialog({ ...described, primary: { label: 'Open settings', onPress: () => router.push('/settings') }, secondary: close });
			} else if (described.action === 'phone-settings') {
				showDialog({ ...described, primary: { label: 'Open phone settings', onPress: () => Linking.openSettings() }, secondary: close });
			} else if (described.action === 'retry' && options.onRetry) {
				showDialog({ ...described, primary: { label: 'Try again', onPress: options.onRetry }, secondary: close });
			} else {
				showDialog({ ...described, primary: { label: 'OK' } });
			}
		},
		[showToast, showDialog],
	);

	const value = useMemo(
		() => ({ toast: showToast, dialog: showDialog, showError }),
		[showToast, showDialog, showError],
	);

	return (
		<FeedbackContext.Provider value={value}>
			<View style={styles.fill}>
				{children}
				{toast && <Toast key={toast.id} toast={toast} onHide={() => setToast(null)} />}
			</View>
			<Dialog dialog={dialogs[0] ?? null} onClose={closeDialog} />
		</FeedbackContext.Provider>
	);
}

export function useFeedback(): Feedback {
	const feedback = useContext(FeedbackContext);
	if (!feedback) throw new Error('useFeedback must be used inside FeedbackProvider');
	return feedback;
}

const styles = StyleSheet.create({
	fill: {
		flex: 1,
	},
});
