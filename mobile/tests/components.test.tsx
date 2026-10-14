import { StyleSheet, Text } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/components/Button';
import { FloatingTabBar, TabBarSpaceContext } from '@/components/FloatingTabBar';
import { OnAirBadge } from '@/components/OnAirBadge';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';

describe('Button', () => {
	it('runs its action when pressed', async () => {
		const onPress = jest.fn();
		await render(<Button label="Save and test" onPress={onPress} />);

		await fireEvent.press(screen.getByRole('button', { name: 'Save and test' }));

		expect(onPress).toHaveBeenCalled();
	});

	it('ignores presses while loading', async () => {
		const onPress = jest.fn();
		await render(<Button label="Save and test" onPress={onPress} loading />);

		await fireEvent.press(screen.getByRole('button'));

		expect(onPress).not.toHaveBeenCalled();
		expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
	});

	it('ignores presses when disabled', async () => {
		const onPress = jest.fn();
		await render(<Button label="Save and test" onPress={onPress} disabled />);

		await fireEvent.press(screen.getByRole('button'));

		expect(onPress).not.toHaveBeenCalled();
	});
});

describe('TextField', () => {
	it('shows its label and passes typed text', async () => {
		const onChangeText = jest.fn();
		await render(<TextField label="Backend address" value="" onChangeText={onChangeText} />);

		await fireEvent.changeText(screen.getByLabelText('Backend address'), 'http://10.0.0.5:8080');

		expect(onChangeText).toHaveBeenCalledWith('http://10.0.0.5:8080');
	});

	it('shows its error under the field', async () => {
		await render(<TextField label="Backend address" value="x" onChangeText={() => {}} error="Enter the backend address." />);

		expect(screen.getByRole('alert')).toBeTruthy();
		expect(screen.getByText('Enter the backend address.')).toBeTruthy();
	});
});

describe('OnAirBadge', () => {
	it('says on air when live updates are connected', async () => {
		await render(<OnAirBadge on />);

		expect(screen.getByText('On air')).toBeTruthy();
	});

	it('says off air when the connection is down', async () => {
		await render(<OnAirBadge on={false} />);

		expect(screen.getByText('Off air')).toBeTruthy();
	});
});

describe('FloatingTabBar', () => {
	function tabBarProps(activeIndex: number) {
		const routes = ['rooms', 'profile', 'friends'].map((name) => ({ key: `${name}-key`, name }));
		const titles: Record<string, string> = { rooms: 'Rooms', profile: 'Profile', friends: 'Friends' };
		const descriptors = Object.fromEntries(
			routes.map((route) => [
				route.key,
				{ options: { title: titles[route.name], tabBarIcon: () => <Text testID={`icon-${route.name}`}>icon</Text> } },
			]),
		);
		const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
		const props = {
			state: { index: activeIndex, routes },
			descriptors,
			navigation,
			insets: { top: 0, bottom: 34, left: 0, right: 0 },
		};
		return { props: props as unknown as BottomTabBarProps, navigation };
	}

	it('shows the active tab with its icon and the others as labels', async () => {
		await render(<FloatingTabBar {...tabBarProps(0).props} />);

		expect(screen.getByTestId('icon-rooms')).toBeTruthy();
		expect(screen.queryByTestId('icon-profile')).toBeNull();
		expect(screen.getByText('Profile')).toBeTruthy();
		expect(screen.getByText('Friends')).toBeTruthy();
	});

	it('tells screen readers which tab is selected', async () => {
		await render(<FloatingTabBar {...tabBarProps(1).props} />);

		expect(screen.getByRole('tab', { name: 'Profile' }).props.accessibilityState).toMatchObject({ selected: true });
		expect(screen.getByRole('tab', { name: 'Rooms' }).props.accessibilityState).toMatchObject({ selected: false });
	});

	it('opens another tab when pressed', async () => {
		const { props, navigation } = tabBarProps(0);
		await render(<FloatingTabBar {...props} />);

		await fireEvent.press(screen.getByRole('tab', { name: 'Friends' }));

		expect(navigation.navigate).toHaveBeenCalledWith('friends', undefined);
	});

	it('stays put when the active tab is pressed again', async () => {
		const { props, navigation } = tabBarProps(0);
		await render(<FloatingTabBar {...props} />);

		await fireEvent.press(screen.getByRole('tab', { name: 'Rooms' }));

		expect(navigation.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', target: 'rooms-key' }));
		expect(navigation.navigate).not.toHaveBeenCalled();
	});
});

describe('Screen', () => {
	it('shows its title as a header and its content', async () => {
		await render(
			<Screen title="Rooms">
				<Text>Content</Text>
			</Screen>,
		);

		expect(screen.getByRole('header', { name: 'Rooms' })).toBeTruthy();
		expect(screen.getByText('Content')).toBeTruthy();
	});

	it('leaves room for the floating tab bar inside the tabs', async () => {
		await render(
			<TabBarSpaceContext.Provider value={100}>
				<Screen title="Rooms">
					<Text>Content</Text>
				</Screen>
			</TabBarSpaceContext.Provider>,
		);

		const scroll = screen.getByTestId('screen-scroll');
		expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(148);
	});
});
