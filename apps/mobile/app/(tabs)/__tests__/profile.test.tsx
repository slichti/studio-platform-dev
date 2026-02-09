import * as React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import ProfileScreen from '../profile';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

// Mocks
jest.mock('../../../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
    LogOut: () => 'LogOutIcon',
    Settings: () => 'SettingsIcon',
    CreditCard: () => 'CreditCardIcon',
    Bell: () => 'BellIcon',
    Flame: () => 'FlameIcon',
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => <>{children}</>,
}));

describe('ProfileScreen', () => {
    const mockSignOut = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({
            signOut: mockSignOut,
        });
    });

    it.skip('renders user details and bookings', async () => {
        (apiRequest as jest.Mock).mockImplementation((path) => {
            if (path === '/tenant/me') {
                return Promise.resolve({
                    firstName: 'John',
                    lastName: 'Doe',
                    user: { email: 'john@example.com' },
                    stats: { currentStreak: 3 },
                });
            }
            if (path === '/bookings/my-upcoming') {
                return Promise.resolve([{
                    id: '1',
                    status: 'confirmed',
                    class: {
                        title: 'Pilates',
                        startTime: new Date().toISOString(),
                    }
                }]);
            }
            return Promise.resolve({});
        });

        const { getByText } = await render(<ProfileScreen />);

        await waitFor(() => {
            expect(getByText('John Doe')).toBeTruthy();
            expect(getByText('john@example.com')).toBeTruthy();
            expect(getByText('3 Day Streak')).toBeTruthy();
            expect(getByText('Pilates')).toBeTruthy();
        });
    });

    it.skip('calls signOut when logout button is pressed', async () => {
        (apiRequest as jest.Mock).mockResolvedValue({});
        const { getByText, getByTestId } = await render(<ProfileScreen />);

        // Wait for loading to complete
        await waitFor(() => expect(getByText('Profile')).toBeTruthy());

        const signOutBtn = getByTestId('sign-out-mem-btn');
        fireEvent.press(signOutBtn);

        expect(mockSignOut).toHaveBeenCalled();
    });
});
