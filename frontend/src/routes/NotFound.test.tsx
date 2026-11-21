import { screen } from '@testing-library/react';

import { renderWithProviders } from '../test/render';
import NotFound from './NotFound';

describe('NotFound', () => {
  beforeEach(() => localStorage.clear());

  test('renders 404 message and a link home', () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  test('speaks Japanese when the device language is Japanese', () => {
    localStorage.setItem('tomo.locale', 'ja');
    renderWithProviders(<NotFound />);
    expect(screen.getByText('ページが見つかりません')).toBeInTheDocument();
  });
});
