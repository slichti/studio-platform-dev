import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'onboarding_';
const KEY_FIRST_BOOKED = `${KEY_PREFIX}first_booked`;
const KEY_NOTIFICATIONS_ENABLED = `${KEY_PREFIX}notifications_enabled`;
const KEY_DISMISSED = `${KEY_PREFIX}dismissed`;

export function useOnboarding() {
    const [firstBooked, setFirstBooked] = useState<boolean | null>(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
    const [dismissed, setDismissed] = useState<boolean | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [fb, ne, dis] = await Promise.all([
                    SecureStore.getItemAsync(KEY_FIRST_BOOKED),
                    SecureStore.getItemAsync(KEY_NOTIFICATIONS_ENABLED),
                    SecureStore.getItemAsync(KEY_DISMISSED),
                ]);
                setFirstBooked(fb === '1');
                setNotificationsEnabled(ne === '1');
                setDismissed(dis === '1');
            } catch {
                setFirstBooked(false);
                setNotificationsEnabled(false);
                setDismissed(false);
            }
        })();
    }, []);

    const markFirstBooked = useCallback(async () => {
        try {
            await SecureStore.setItemAsync(KEY_FIRST_BOOKED, '1');
            setFirstBooked(true);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const markNotificationsEnabled = useCallback(async () => {
        try {
            await SecureStore.setItemAsync(KEY_NOTIFICATIONS_ENABLED, '1');
            setNotificationsEnabled(true);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const markDismissed = useCallback(async () => {
        try {
            await SecureStore.setItemAsync(KEY_DISMISSED, '1');
            setDismissed(true);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const hydrated = firstBooked !== null && notificationsEnabled !== null && dismissed !== null;
    const showOnboarding = hydrated && !dismissed && (!firstBooked || !notificationsEnabled);

    return {
        showOnboarding: !!showOnboarding,
        firstBooked: !!firstBooked,
        notificationsEnabled: !!notificationsEnabled,
        hydrated,
        markFirstBooked,
        markNotificationsEnabled,
        markDismissed,
    };
}
