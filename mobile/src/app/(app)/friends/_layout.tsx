import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Friends tab: Oleg's friends screens go in this folder
export default function FriendsLayout() {
	return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
