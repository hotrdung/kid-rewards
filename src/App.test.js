// src/App.test.js
import { render, screen } from '@testing-library/react';
import App from './App'; // This import remains the same

test('renders learn react link', () => {
  render(<App />);
  // This test will likely fail or need adjustment as "learn react" is default CRA content
  // and your app no longer shows it once logged in.
  // You'll want to update tests to reflect your actual application's initial state,
  // perhaps checking for the "Initializing App" message or the Login screen.
  // For example, if it shows the login button:
  // const loginButton = screen.getByRole('button', { name: /login with google/i });
  // expect(loginButton).toBeInTheDocument();
  const headerTitle = screen.getByText(/Kid Rewards/i);
  expect(headerTitle).toBeInTheDocument();
});

