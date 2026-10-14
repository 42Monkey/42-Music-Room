import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LaunchAnimation } from '@/components/LaunchAnimation';
import { FeedbackProvider } from '@/feedback/FeedbackProvider';
import { SessionProvider, useSession } from '@/session/SessionProvider';
import { SessionWatcher } from '@/session/SessionWatcher';
import { SettingsProvider, useSettings } from '@/settings/SettingsProvider';
import { ConnectionWatcher } from '@/socket/ConnectionWatcher';
import { SocketProvider } from '@/socket/SocketProvider';
import { colors } from '@/theme';

// Phone launch screen stays until the opening animation takes over
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<SettingsProvider>
				<FeedbackProvider>
					<SessionProvider>
						<SocketProvider>
							<StatusBar style="dark" />
							<RootNavigator />
							<SessionWatcher />
							<ConnectionWatcher />
						</SocketProvider>
					</SessionProvider>
				</FeedbackProvider>
			</SettingsProvider>
		</SafeAreaProvider>
	);
}

// Logged-in and logged-out screens never mix
function RootNavigator() {
	const { ready } = useSettings();
	const { status } = useSession();
	const loading = !ready || status === 'loading';
	const signedIn = status === 'signedIn';

	return (
		<>
			<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
				<Stack.Protected guard={signedIn}>
					<Stack.Screen name="(app)" />
				</Stack.Protected>
				<Stack.Protected guard={!signedIn}>
					<Stack.Screen name="(auth)" />
				</Stack.Protected>
				<Stack.Screen name="settings" options={{ presentation: 'modal' }} />
			</Stack>
			<LaunchAnimation ready={!loading} />
		</>
	);
}
