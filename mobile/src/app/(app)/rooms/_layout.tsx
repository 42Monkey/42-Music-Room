import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Rooms tab: rooms slide in on top of the list, the new room form rises as a sheet
export default function RoomsLayout() {
	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
			<Stack.Screen name="new" options={{ presentation: 'modal' }} />
		</Stack>
	);
}
