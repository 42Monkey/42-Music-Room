import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

// Logged-in screens: bottom tabs
export default function AppLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: colors.accent,
				tabBarInactiveTintColor: colors.muted,
				tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
			}}
		>
			<Tabs.Screen
				name="rooms"
				options={{ title: 'Rooms', tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes" color={color} size={size} /> }}
			/>
			<Tabs.Screen
				name="profile"
				options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} /> }}
			/>
			<Tabs.Screen
				name="friends"
				options={{ title: 'Friends', tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }}
			/>
		</Tabs>
	);
}
