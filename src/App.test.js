import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Viola header', () => {
  render(<App />);
  const heading = screen.getByText(/viola/i);
  expect(heading).toBeInTheDocument();
});
