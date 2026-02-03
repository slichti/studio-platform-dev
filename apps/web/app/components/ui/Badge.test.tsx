
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './Badge';
import '@testing-library/jest-dom';

describe('Badge Component', () => {
    it('renders with default variant', () => {
        render(<Badge>Default</Badge>);
        const badge = screen.getByText('Default');
        expect(badge).toBeInTheDocument();
        // Check for default classes (bg-zinc-900)
        expect(badge).toHaveClass('bg-zinc-900');
    });

    it('renders with destructive variant', () => {
        render(<Badge variant="destructive">Error</Badge>);
        const badge = screen.getByText('Error');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-red-500');
    });

    it('renders with success variant', () => {
        render(<Badge variant="success">Success</Badge>);
        const badge = screen.getByText('Success');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('bg-emerald-100');
    });
});
