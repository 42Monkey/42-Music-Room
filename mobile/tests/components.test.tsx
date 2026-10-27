import { StyleSheet, Text } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import * as SplashScreen from 'expo-splash-screen';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/components/Button';
import { FloatingTabBar, TabBarSpaceContext } from '@/components/FloatingTabBar';
import { LaunchAnimation } from '@/components/LaunchAnimation';
import { OnAirBadge } from '@/components/OnAirBadge';
import { SegmentedControl } from '@/components/SegmentedControl';
import { formatTime, TimeField } from '@/components/TimeField';
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

jest.mock('expo-splash-screen', () => ({
	preventAutoHideAsync: jest.fn(async () => {}),
	hideAsync: jest.fn(async () => {}),
}));

describe('LaunchAnimation', () => {
	const loader = () => screen.queryByRole('progressbar', { name: 'Loading Music Room' });

	beforeEach(() => {
		jest.useFakeTimers();
	});

	// Remove it while the fake clock still runs, or its pending timers never fire
	afterEach(async () => {
		await cleanup();
		jest.useRealTimers();
	});

	it('takes over from the phone launch screen once drawn', async () => {
		await render(<LaunchAnimation ready={false} />);

		await fireEvent(loader()!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });

		expect(SplashScreen.hideAsync).toHaveBeenCalled();
		expect(screen.getByText('Music Room')).toBeTruthy();
	});

	it('stays while the app is loading', async () => {
		await render(<LaunchAnimation ready={false} />);

		await act(() => jest.advanceTimersByTime(5000));

		expect(loader()).toBeTruthy();
	});

	it('plays the intro even when the app is already ready', async () => {
		await render(<LaunchAnimation ready />);

		await act(() => jest.advanceTimersByTime(1500));
		expect(loader()).toBeTruthy();

		await act(() => jest.advanceTimersByTime(500));
		await act(() => jest.advanceTimersByTime(500));
		expect(loader()).toBeNull();
	});

	it('leaves once the app is ready', async () => {
		const view = await render(<LaunchAnimation ready={false} />);
		await act(() => jest.advanceTimersByTime(3000));

		await act(() => view.rerender(<LaunchAnimation ready />));
		await act(() => jest.advanceTimersByTime(500));

		expect(loader()).toBeNull();
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

describe('SegmentedControl', () => {
	const OPTIONS = [
		{ value: 'PUBLIC', label: 'Public' },
		{ value: 'PRIVATE', label: 'Private' },
	];

	it('shows which option is chosen', async () => {
		await render(<SegmentedControl label="Who can see it" options={OPTIONS} value="PUBLIC" onChange={() => {}} />);

		expect(screen.getByRole('radio', { name: 'Public' }).props.accessibilityState).toMatchObject({ checked: true });
		expect(screen.getByRole('radio', { name: 'Private' }).props.accessibilityState).toMatchObject({ checked: false });
	});

	it('picks another option when pressed', async () => {
		const onChange = jest.fn();
		await render(<SegmentedControl label="Who can see it" options={OPTIONS} value="PUBLIC" onChange={onChange} />);

		await fireEvent.press(screen.getByRole('radio', { name: 'Private' }));

		expect(onChange).toHaveBeenCalledWith('PRIVATE');
	});
});

describe('TimeField', () => {
	it('shows its label and passes the picked time', async () => {
		const onChange = jest.fn();
		await render(<TimeField label="Opens at" value={new Date(2026, 9, 14, 20, 0)} onChange={onChange} />);

		expect(screen.getByText('Opens at')).toBeTruthy();
		await fireEvent.press(screen.getByTestId('time-picker'));

		expect(onChange).toHaveBeenCalledWith(new Date(2026, 9, 14, 21, 30));
	});

	it('formats times on 24 hours', () => {
		expect(formatTime(new Date(2026, 9, 14, 9, 5))).toBe('09:05');
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
		const emitter = { emit: jest.fn(() => ({ defaultPrevented: false })) };
		const navigateToTab = jest.fn();
		const props = {
			state: { index: activeIndex, routes },
			descriptors,
			emitter,
			navigateToTab,
			insets: { top: 0, bottom: 34, left: 0, right: 0 },
		};
		return { props: props as unknown as BottomTabBarProps, emitter, navigateToTab };
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
		const { props, navigateToTab } = tabBarProps(0);
		await render(<FloatingTabBar {...props} />);

		await fireEvent.press(screen.getByRole('tab', { name: 'Friends' }));

		expect(navigateToTab).toHaveBeenCalledWith('friends-key');
	});

	it('stays put when the active tab is pressed again', async () => {
		const { props, emitter, navigateToTab } = tabBarProps(0);
		await render(<FloatingTabBar {...props} />);

		await fireEvent.press(screen.getByRole('tab', { name: 'Rooms' }));

		expect(emitter.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'tabPress', target: 'rooms-key' }));
		expect(navigateToTab).not.toHaveBeenCalled();
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
