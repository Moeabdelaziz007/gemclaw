/**
 * @vitest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';
import { useTheme } from '@/hooks/useTheme';

// Mock useTheme hook
vi.mock('@/hooks/useTheme', () => ({
  useTheme: vi.fn(),
}));

describe('ThemeToggle Component', () => {
  const mockUseTheme = vi.mocked(useTheme);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render toggle button', () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
    });

    render(<ThemeToggle />);
    const toggleButton = screen.getByRole('switch'); // Adjusted based on actual implementation
    expect(toggleButton).toBeInTheDocument();
  });
});
