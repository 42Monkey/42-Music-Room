import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { api } from '@/api/client';
import { normalizeServerUrl } from '@/settings/serverUrl';
import { SettingsProvider, useSettings } from '@/settings/SettingsProvider';
import { mockFetch, reply } from './helpers';

describe('normalizeServerUrl', () => {
	it('keeps a full address and drops the trailing slash', () => {
		expect(normalizeServerUrl(' https://abc.trycloudflare.com/ ')).toEqual({
			ok: true,
			url: 'https://abc.trycloudflare.com',
		});
	});

	it('adds http:// to a local IP address', () => {
		expect(normalizeServerUrl('192.168.1.10:8080')).toEqual({ ok: true, url: 'http://192.168.1.10:8080' });
	});

	it('adds http:// to localhost', () => {
		expect(normalizeServerUrl('localhost:8080')).toEqual({ ok: true, url: 'http://localhost:8080' });
	});

	it('adds https:// to a domain name', () => {
		expect(normalizeServerUrl('abc.trycloudflare.com')).toEqual({
			ok: true,
			url: 'https://abc.trycloudflare.com',
		});
	});

	it('asks for an address when the field is empty', () => {
		expect(normalizeServerUrl('   ')).toEqual({ ok: false, error: 'Enter the backend address.' });
	});

	it('rejects text that is not an address', () => {
		expect(normalizeServerUrl('not an address').ok).toBe(false);
	});

	it('rejects other protocols', () => {
		expect(normalizeServerUrl('ftp://192.168.1.10').ok).toBe(false);
	});

	it('refuses plain http for a public address', () => {
		expect(normalizeServerUrl('http://abc.trycloudflare.com')).toEqual({
			ok: false,
			error: 'Use https:// for addresses outside your local network, so your login is not sent in clear text.',
		});
	});

	it('allows plain http on the local network', () => {
		expect(normalizeServerUrl('http://172.20.0.4:8080').ok).toBe(true);
		expect(normalizeServerUrl('http://10.0.2.2:8080').ok).toBe(true);
	});
});

async function renderSettings() {
	const view = await renderHook(() => useSettings(), { wrapper: SettingsProvider });
	await waitFor(() => expect(view.result.current.ready).toBe(true));
	return view;
}

describe('SettingsProvider', () => {
	beforeEach(async () => {
		await AsyncStorage.clear();
		process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.10:8080';
	});

	it('uses the default address when none is saved', async () => {
		const { result } = await renderSettings();

		expect(result.current.serverUrl).toBe('http://192.168.1.10:8080');
		expect(result.current.isCustom).toBe(false);
	});

	it('uses the address saved on the phone', async () => {
		await AsyncStorage.setItem('serverUrl', 'https://abc.trycloudflare.com');

		const { result } = await renderSettings();

		expect(result.current.serverUrl).toBe('https://abc.trycloudflare.com');
		expect(result.current.isCustom).toBe(true);
	});

	it('saves a new address', async () => {
		const { result } = await renderSettings();

		await act(() => result.current.saveServerUrl('http://10.0.0.5:8080'));

		expect(result.current.serverUrl).toBe('http://10.0.0.5:8080');
		expect(await AsyncStorage.getItem('serverUrl')).toBe('http://10.0.0.5:8080');
	});

	it('goes back to the default address', async () => {
		await AsyncStorage.setItem('serverUrl', 'http://10.0.0.5:8080');
		const { result } = await renderSettings();

		await act(() => result.current.resetServerUrl());

		expect(result.current.serverUrl).toBe('http://192.168.1.10:8080');
		expect(await AsyncStorage.getItem('serverUrl')).toBeNull();
	});

	it('points the API at the current address', async () => {
		await AsyncStorage.setItem('serverUrl', 'http://10.0.0.5:8080');
		const fetchMock = mockFetch();
		fetchMock.mockResolvedValue(reply(200));

		await renderSettings();
		await api.get('/health');

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:8080/health');
	});

	it('points the API at a new address right after saving it', async () => {
		const fetchMock = mockFetch();
		fetchMock.mockResolvedValue(reply(200));
		const { result } = await renderSettings();

		await act(async () => {
			await result.current.saveServerUrl('http://10.0.0.7:8080');
			await api.get('/health');
		});

		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.7:8080/health');
	});
});
