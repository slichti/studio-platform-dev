import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text, View } from '../Themed';
import { useColorScheme } from '../useColorScheme';

// Mock useColorScheme
jest.mock('../useColorScheme', () => ({
    useColorScheme: jest.fn(),
}));

describe('Themed', () => {
    it('renders text with light color by default', async () => {
        (useColorScheme as jest.Mock).mockReturnValue('light');
        const { getByText } = await render(<Text>Light Text</Text>);
        const textElement = getByText('Light Text');
        // Default light text is #000
        expect(textElement.props.style).toEqual(expect.arrayContaining([{ color: '#000' }]));
    });

    it('renders text with dark color when theme is dark', async () => {
        (useColorScheme as jest.Mock).mockReturnValue('dark');
        const { getByText } = await render(<Text>Dark Text</Text>);
        const textElement = getByText('Dark Text');
        // Default dark text is #fff
        expect(textElement.props.style).toEqual(expect.arrayContaining([{ color: '#fff' }]));
    });

    it('renders view with light background by default', async () => {
        (useColorScheme as jest.Mock).mockReturnValue('light');
        const { getByTestId } = await render(<View testID="themed-view" />);
        const viewElement = getByTestId('themed-view');
        // Default light background is #fff
        expect(viewElement.props.style).toEqual(expect.arrayContaining([{ backgroundColor: '#fff' }]));
    });
});
