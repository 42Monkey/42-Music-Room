import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Rooms tab: room screens stack on top of the list
export default function RoomsLayout() {
	return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
