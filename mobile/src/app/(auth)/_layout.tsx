import { Stack } from 'expo-router';
import { colors } from '@/theme';

// Logged-out screens (Oleg)
export default function AuthLayout() {
	return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
