import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Rooms tab: rooms slide in on top of the list, forms and track search rise as sheets
export default function RoomsLayout() {
	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
			<Stack.Screen name="new" options={{ presentation: 'modal' }} />
			<Stack.Screen name="add-track" options={{ presentation: 'modal' }} />
		</Stack>
	);
}
