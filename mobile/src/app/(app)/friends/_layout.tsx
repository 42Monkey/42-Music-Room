import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Friends tab: search and a person's profile slide in on top of the list
export default function FriendsLayout() {
	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="[id]" />
			<Stack.Screen name="search" />
		</Stack>
	);
}
