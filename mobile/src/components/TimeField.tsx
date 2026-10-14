import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, space, type } from '@/theme';

type Props = {
	label: string;
	value: Date;
	onChange: (value: Date) => void;
};

// "09:05" style, the same on every phone
export function formatTime(date: Date): string {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Time picker: inline on iPhone, a dialog on Android
export function TimeField({ label, value, onChange }: Props) {
	const [open, setOpen] = useState(false);

	const pick = (event: DateTimePickerEvent, date?: Date) => {
		setOpen(false);
		if (event.type === 'set' && date) onChange(date);
	};

	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			{Platform.OS === 'ios' ? (
				<View style={styles.iosRow}>
					<DateTimePicker
						value={value}
						mode="time"
						display="compact"
						locale="en-GB"
						accentColor={colors.accent}
						accessibilityLabel={label}
						onChange={pick}
					/>
				</View>
			) : (
				<>
					<Pressable
						onPress={() => setOpen(true)}
						accessibilityRole="button"
						accessibilityLabel={`${label}, ${formatTime(value)}`}
						style={({ pressed }) => [styles.androidButton, pressed && styles.pressed]}
					>
						<Text style={styles.time}>{formatTime(value)}</Text>
					</Pressable>
					{open && <DateTimePicker value={value} mode="time" is24Hour onChange={pick} />}
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	field: {
		flex: 1,
		gap: space.sm,
	},
	label: {
		...type.caption,
		color: colors.muted,
	},
	iosRow: {
		alignItems: 'flex-start',
	},
	androidButton: {
		minHeight: 48,
		borderRadius: radius.control,
		borderWidth: 1.5,
		borderColor: colors.line,
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
	},
	pressed: {
		opacity: 0.6,
	},
	time: {
		...type.headline,
		color: colors.ink,
		fontVariant: ['tabular-nums'],
	},
});
