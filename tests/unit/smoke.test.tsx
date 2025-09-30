import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../../App';

describe('App', () => {
  it('renders without crashing', () => {
    const component = render(<App />);
    // Basic smoke test - just ensure the app renders
    expect(component).toBeDefined();
  });
});
