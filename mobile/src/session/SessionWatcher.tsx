import { useEffect } from 'react';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useSession } from './SessionProvider';

// Explains why the user lands back on the login screen
export function SessionWatcher() {
	const { expired, dismissExpired, restoreError, retryRestore } = useSession();
	const { dialog, showError } = useFeedback();

	useEffect(() => {
		if (!expired) return;
		dialog({
			title: 'Session ended',
			message: 'Your session expired. Log in again to continue.',
			primary: { label: 'OK' },
		});
		dismissExpired();
	}, [expired, dialog, dismissExpired]);

	// Saved login could not be checked: server down or wrong address
	useEffect(() => {
		if (restoreError) showError(restoreError, { onRetry: retryRestore });
	}, [restoreError, showError, retryRestore]);

	return null;
}
