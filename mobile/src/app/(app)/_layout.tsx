import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FloatingTabBar, TabBarSpaceContext, tabBarSpace } from '@/components/FloatingTabBar';

// Tab icon; FloatingTabBar always passes a theme color, which is a string
function tabIcon(name: ComponentProps<typeof Ionicons>['name']) {
	return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
}

// Logged-in screens: floating pill tab bar
export default function AppLayout() {
	const insets = useSafeAreaInsets();

	return (
		<TabBarSpaceContext.Provider value={tabBarSpace(insets.bottom)}>
			<Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
				<Tabs.Screen name="rooms" options={{ title: 'Rooms', tabBarIcon: tabIcon('musical-notes') }} />
				<Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle') }} />
				<Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: tabIcon('people') }} />
			</Tabs>
		</TabBarSpaceContext.Provider>
	);
}
