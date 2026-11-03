import React from 'react';
import { render } from '@testing-library/react';
import ConnectionIndicator from '../../../web/components/ConnectionIndicator';

describe('ConnectionIndicator', () => {
  it('renders connected status with correct title', () => {
    const { container } = render(
      <ConnectionIndicator status="connected" label="WS" />
    );
    const indicator = container.firstChild as HTMLElement;
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('title')).toBe('WS: connected');
  });

  it('renders disconnected status with correct title', () => {
    const { container } = render(
      <ConnectionIndicator status="disconnected" label="Launcher" />
    );
    const indicator = container.firstChild as HTMLElement;
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('title')).toBe('Launcher: disconnected');
  });

  it('displays the label text', () => {
    const { getByText } = render(
      <ConnectionIndicator status="connected" label="WS" />
    );
    expect(getByText('WS')).toBeTruthy();
  });

  it('renders dot element', () => {
    const { container } = render(
      <ConnectionIndicator status="connected" label="WS" />
    );
    const spans = container.querySelectorAll('span');
    // dot + label = 2 spans
    expect(spans.length).toBe(2);
  });
});
