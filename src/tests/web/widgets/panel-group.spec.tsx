import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import PanelGroup from '../../../web/widgets/PanelGroup';

describe('PanelGroup', () => {
  it('renders tabs and selects first tab by default', () => {
    const { getByText } = render(
      <PanelGroup
        tabs={[
          { key: 'tab1', content: <div>Content 1</div> },
          { key: 'tab2', content: <div>Content 2</div> },
        ]}
      />
    );
    expect(getByText('tab1')).toBeTruthy();
    expect(getByText('tab2')).toBeTruthy();
    expect(getByText('Content 1')).toBeTruthy();
  });

  it('switches content when tab is clicked', () => {
    const { getByText, queryByText } = render(
      <PanelGroup
        tabs={[
          { key: 'tab1', content: <div>Content 1</div> },
          { key: 'tab2', content: <div>Content 2</div> },
        ]}
      />
    );

    fireEvent.click(getByText('tab2'));
    expect(queryByText('Content 2')).toBeTruthy();
  });

  it('does not crash when dataset.key is missing', () => {
    const { getByText } = render(
      <PanelGroup
        tabs={[
          { key: 'tab1', content: <div>Content 1</div> },
          { key: 'tab2', content: <div>Content 2</div> },
        ]}
      />
    );

    // Verify initial state (tab1 selected)
    expect(getByText('Content 1')).toBeTruthy();

    // Add a child element without data-key inside the tab area and click it
    const tabElement = getByText('tab1');
    const extraSpan = document.createElement('span');
    extraSpan.textContent = 'no-key';
    tabElement.parentElement!.appendChild(extraSpan);

    // Click the element without data-key - handleClick should early-return
    fireEvent.click(extraSpan);

    // State should remain unchanged (tab1 still selected)
    expect(getByText('Content 1')).toBeTruthy();
  });

  it('renders empty when tabs array is empty', () => {
    const { container } = render(<PanelGroup tabs={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
