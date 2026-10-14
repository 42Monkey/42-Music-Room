import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FloatingTabBar, TabBarSpaceContext, tabBarSpace } from '@/components/FloatingTabBar';

// Logged-in screens: floating pill tab bar
export default function AppLayout() {
	const insets = useSafeAreaInsets();

	return (
		<TabBarSpaceContext.Provider value={tabBarSpace(insets.bottom)}>
			<Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
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
		</TabBarSpaceContext.Provider>
	);
}
