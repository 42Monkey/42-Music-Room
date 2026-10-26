import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, type } from '@/theme';

// Same size as the launch image in app.json, so the dot does not jump
const SIZE = 200;
const INNER = ['M38 36 A20 20 0 0 0 38 64', 'M62 36 A20 20 0 0 1 62 64'];
const OUTER = ['M28 26 A34 34 0 0 0 28 74', 'M72 26 A34 34 0 0 1 72 74'];
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const INTRO_MS = 2000;
const REDUCED_INTRO_MS = 600;
const EXIT_MS = 450;

type Props = {
	ready: boolean;
};

// One pair of waves, drawn on the icon's 100x100 grid
function Waves({ paths }: { paths: string[] }) {
	return (
		<Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
			{paths.map((d) => (
				<Path key={d} d={d} stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" fill="none" />
			))}
		</Svg>
	);
}

// Opening animation: the dot goes on air, then fades into the app once ready
export function LaunchAnimation({ ready }: Props) {
	const reduceMotion = useReducedMotion();
	const [introDone, setIntroDone] = useState(false);
	const [gone, setGone] = useState(false);
	const dot = useSharedValue(1);
	const inner = useSharedValue(0);
	const outer = useSharedValue(0);
	const name = useSharedValue(0);
	const pulse = useSharedValue(1);
	const exit = useSharedValue(0);
	const waveStart = reduceMotion ? 1 : 0.6;

	// Dot pops, waves ripple out one after the other, then the name (runs once)
	useEffect(() => {
		const show = (delay: number, duration = 550) => withDelay(delay, withTiming(1, { duration, easing: EASE_OUT }));
		if (reduceMotion) {
			inner.value = show(0, 300);
			outer.value = show(0, 300);
			name.value = show(0, 300);
		} else {
			dot.value = withDelay(
				300,
				withSequence(
					withTiming(1.25, { duration: 200, easing: EASE_OUT }),
					withTiming(1, { duration: 300, easing: EASE_OUT }),
				),
			);
			inner.value = show(450);
			outer.value = show(750);
			name.value = show(1200, 450);
		}
		const timer = setTimeout(() => setIntroDone(true), reduceMotion ? REDUCED_INTRO_MS : INTRO_MS);
		return () => clearTimeout(timer);
	}, [reduceMotion]);

	// Waves keep pulsing if the app is still loading
	useEffect(() => {
		if (!introDone || ready || reduceMotion) return;
		const half = { duration: 500, easing: Easing.inOut(Easing.ease) };
		pulse.value = withRepeat(withSequence(withTiming(0.4, half), withTiming(1, half)), -1);
		return () => {
			cancelAnimation(pulse);
			pulse.value = withTiming(1, { duration: 150 });
		};
	}, [introDone, ready, reduceMotion]);

	// Logo grows a little while the screen fades into the app
	useEffect(() => {
		if (!introDone || !ready) return;
		exit.value = withTiming(1, { duration: EXIT_MS, easing: EASE_OUT });
		const timer = setTimeout(() => setGone(true), EXIT_MS);
		return () => clearTimeout(timer);
	}, [introDone, ready]);

	const fade = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
	const grow = useAnimatedStyle(() => ({ transform: [{ scale: reduceMotion ? 1 : 1 + 0.08 * exit.value }] }));
	const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: dot.value }] }));
	const innerStyle = useAnimatedStyle(() => ({
		opacity: inner.value * pulse.value,
		transform: [{ scale: waveStart + (1 - waveStart) * inner.value }],
	}));
	const outerStyle = useAnimatedStyle(() => ({
		opacity: outer.value * pulse.value,
		transform: [{ scale: waveStart + (1 - waveStart) * outer.value }],
	}));
	const nameStyle = useAnimatedStyle(() => ({
		opacity: name.value,
		transform: [{ translateY: reduceMotion ? 0 : (1 - name.value) * 8 }],
	}));

	if (gone) return null;

	return (
		<Animated.View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel="Loading Music Room"
			onLayout={() => SplashScreen.hideAsync().catch(() => {})}
			style={[styles.overlay, introDone && ready && styles.passThrough, fade]}
		>
			<StatusBar style="light" />
			<Animated.View style={[styles.logo, grow]}>
				<Animated.View style={[StyleSheet.absoluteFill, outerStyle]}>
					<Waves paths={OUTER} />
				</Animated.View>
				<Animated.View style={[StyleSheet.absoluteFill, innerStyle]}>
					<Waves paths={INNER} />
				</Animated.View>
				<Animated.View style={[StyleSheet.absoluteFill, dotStyle]}>
					<Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
						<Circle cx={50} cy={50} r={7.5} fill="#FFFFFF" />
					</Svg>
				</Animated.View>
			</Animated.View>
			<Animated.Text style={[styles.name, nameStyle]}>Music Room</Animated.Text>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFill,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.accent,
	},
	passThrough: {
		pointerEvents: 'none',
	},
	logo: {
		width: SIZE,
		height: SIZE,
	},
	// Just under the outer waves, without moving the logo off centre
	name: {
		...type.title,
		position: 'absolute',
		top: '50%',
		left: 0,
		right: 0,
		marginTop: 76,
		textAlign: 'center',
		color: '#FFFFFF',
	},
});
