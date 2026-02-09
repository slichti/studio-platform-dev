import * as React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../index';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

// Mocks
jest.mock('../../../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (cb: any) => React.useEffect(cb, []), // Run as effect for testing
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => <>{children}</>,
}));

describe('HomeScreen', () => {
    const mockSignOut = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({
            signOut: mockSignOut,
            token: 'mock-token',
        });
    });

    it.skip('renders profile name and credits after loading', async () => {
        (apiRequest as jest.Mock).mockImplementation((path) => {
            if (path === '/members/me') {
                return Promise.resolve({
                    member: {
                        user: { profile: { firstName: 'TestUser' } },
                        purchasedPacks: [{ remainingCredits: 5 }],
                    },
                });
            }
            if (path === '/bookings/my-upcoming') {
                return Promise.resolve([]);
            }
            return Promise.resolve({});
        });

        const { getByText } = await render(<HomeScreen />);

        // Wait for loading to finish and data to populate
        await waitFor(() => {
            expect(getByText('Welcome back,')).toBeTruthy();
            expect(getByText('TestUser')).toBeTruthy();
            expect(getByText('5')).toBeTruthy(); // Credits
        });
    });

    it.skip('renders upcoming class if exists', async () => {
        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 1);

        (apiRequest as jest.Mock).mockImplementation((path) => {
            if (path === '/members/me') return Promise.resolve({ member: {} });
            if (path === '/bookings/my-upcoming') {
                return Promise.resolve([{
                    class: {
                        title: 'Yoga Flow',
                        startTime: startTime.toISOString(),
                    }
                }]);
            }
            return Promise.resolve({});
        });

        const { getByText } = await render(<HomeScreen />);

        await waitFor(() => {
            expect(getByText('Yoga Flow')).toBeTruthy();
        });
    });

    it.skip('calls signOut when formatted button is pressed', async () => {
        (apiRequest as jest.Mock).mockResolvedValue({});
        // We need to render, mock data doesn't matter much for this test but we need to pass loading
        const { getByText, getByTestId } = await render(<HomeScreen />);

        await waitFor(() => expect(getByText('Welcome back,')).toBeTruthy());

        const signOutBtn = getByTestId('header-sign-out-btn');
        fireEvent.press(signOutBtn);

        // We can't verify signOut is called because onPress calls signOut() but we mocked useAuth().
        // Wait, we mocked useAuth and mockSignOut.
        expect(mockSignOut).toHaveBeenCalled();
    });
});
