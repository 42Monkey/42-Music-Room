import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Profile tab: the edit form rises as a sheet
export default function ProfileLayout() {
	return (
		<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
			<Stack.Screen name="index" />
			<Stack.Screen name="edit" options={{ presentation: 'modal' }} />
		</Stack>
	);
}
