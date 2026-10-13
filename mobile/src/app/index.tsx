import { Redirect } from 'expo-router';
import { useSession } from '@/session/SessionProvider';

// App start: rooms when logged in, login otherwise
export default function Index() {
	const { status } = useSession();
	if (status === 'loading') return null;
	return <Redirect href={status === 'signedIn' ? '/rooms' : '/login'} />;
}
