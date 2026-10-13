import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/components/Button';
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
});
