import React from 'react';
import StatusBadge from './StatusBadge';

type Item = { color: string, text: string, key: string };

type StatusBarProps = {
  values: Array<Item>
}

type StatusBarState = {
}

function generateJSXFromItem(item: Item): JSX.Element {
  return (
    <div className="flex_elem_fix" key={item.key}>
      <StatusBadge color={item.color}>{item.text}</StatusBadge>
    </div>
  );
}

class StatusBar extends React.Component<StatusBarProps, StatusBarState> {
  constructor(props: StatusBarProps) {
    super(props);
  }

  render(): JSX.Element {
    return (
      <div className="flex_row">
        {this.props.values?.map(generateJSXFromItem)}
      </div>
    );
  }
}

export default StatusBar;