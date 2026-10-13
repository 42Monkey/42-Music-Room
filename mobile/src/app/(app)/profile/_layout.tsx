import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Profile tab: Oleg's profile screens go in this folder
export default function ProfileLayout() {
	return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
