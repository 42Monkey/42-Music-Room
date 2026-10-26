import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, space, type } from '@/theme';

type Props = {
	label: string;
	// null: no date yet
	value: Date | null;
	onChange: (value: Date | null) => void;
	// Picked first when there is no date yet
	startAt: Date;
	minimumDate?: Date;
	maximumDate?: Date;
};

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

// "14 October 1995", by hand: the phone's own format may use another calendar (Thai, Japanese...)
export function formatDate(date: Date): string {
	return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// Date picker that can stay empty: inline on iPhone, a dialog on Android
export function DateField({ label, value, onChange, startAt, minimumDate, maximumDate }: Props) {
	const [open, setOpen] = useState(false);

	const pick = (event: DateTimePickerEvent, date?: Date) => {
		setOpen(false);
		if (event.type === 'set' && date) onChange(date);
	};

	// iPhone's compact picker needs a date, so an empty field starts from a button
	const field =
		Platform.OS === 'ios' && value ? (
			<DateTimePicker
				value={value}
				mode="date"
				display="compact"
				locale="en-GB"
				accentColor={colors.accent}
				minimumDate={minimumDate}
				maximumDate={maximumDate}
				accessibilityLabel={label}
				onChange={pick}
			/>
		) : (
			<Pressable
				onPress={() => (Platform.OS === 'ios' ? onChange(startAt) : setOpen(true))}
				accessibilityRole="button"
				accessibilityLabel={`${label}, ${value ? formatDate(value) : 'not set'}`}
				style={({ pressed }) => [styles.button, pressed && styles.pressed]}
			>
				<Text style={[styles.date, !value && styles.empty]}>{value ? formatDate(value) : 'Not set'}</Text>
			</Pressable>
		);

	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<View style={styles.row}>
				{field}
				{value && (
					<Pressable
						onPress={() => onChange(null)}
						accessibilityRole="button"
						accessibilityLabel={`Clear ${label}`}
						hitSlop={12}
						style={({ pressed }) => pressed && styles.pressed}
					>
						<Text style={styles.clear}>Clear</Text>
					</Pressable>
				)}
			</View>
			{open && (
				<DateTimePicker
					value={value ?? startAt}
					mode="date"
					minimumDate={minimumDate}
					maximumDate={maximumDate}
					onChange={pick}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	field: {
		gap: space.sm,
	},
	label: {
		...type.caption,
		color: colors.muted,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.lg,
	},
	button: {
		minHeight: 48,
		paddingHorizontal: space.lg,
		borderRadius: radius.control,
		borderWidth: 1.5,
		borderColor: colors.line,
		backgroundColor: colors.surface,
		justifyContent: 'center',
	},
	pressed: {
		opacity: 0.6,
	},
	date: {
		...type.body,
		color: colors.ink,
	},
	empty: {
		color: colors.muted,
	},
	clear: {
		...type.callout,
		fontWeight: '600',
		color: colors.accent,
	},
});
