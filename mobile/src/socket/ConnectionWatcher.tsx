import { useEffect, useRef } from 'react';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useSocket } from './SocketProvider';

// Toasts when live updates drop and come back
export function ConnectionWatcher() {
	const { connected } = useSocket();
	const { toast } = useFeedback();
	const wasConnected = useRef(false);
	const dropped = useRef(false);

	useEffect(() => {
		if (connected && dropped.current) {
			toast('Live updates are back.', 'success');
			dropped.current = false;
		} else if (!connected && wasConnected.current) {
			toast('Live updates paused. Reconnecting…', 'info');
			dropped.current = true;
		}
		wasConnected.current = connected;
	}, [connected, toast]);

	return null;
}
