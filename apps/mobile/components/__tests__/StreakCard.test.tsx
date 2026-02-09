import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import StreakCard from '../StreakCard';

describe('StreakCard', () => {
    it('renders 0 day streak correctly', async () => {
        const { getByText } = await render(<StreakCard streak={0} />);
        expect(getByText('0 Day Streak')).toBeTruthy();
        expect(getByText('Book a class to start your streak!')).toBeTruthy();
    });

    it('renders positive streak correctly', async () => {
        const { getByText } = await render(<StreakCard streak={5} />);
        expect(getByText('5 Day Streak')).toBeTruthy();
        expect(getByText("You're on fire! Keep it up.")).toBeTruthy();
    });
});
