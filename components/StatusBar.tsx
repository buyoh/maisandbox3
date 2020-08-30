import React from 'react';
import StatusBadge from './StatusBadge';

type ClickHandler = (key: string) => void;
type Key = string;
type Item = {
  color: string,
  text: string,
  key: Key,
  onClick?: ClickHandler
};

type StatusBarProps = {
  values: Array<Item>,
  active?: Key
}

type StatusBarState = {
}

class StatusBar extends React.Component<StatusBarProps, StatusBarState> {
  constructor(props: StatusBarProps) {
    super(props);
    this.generateJSXFromItem = this.generateJSXFromItem.bind(this);
  }

  private generateJSXFromItem(item: Item): JSX.Element {
    return (
      <div className="flex_elem_fix" key={item.key} onClick={() => { item.onClick?.call(null, item.key); }}>
        <StatusBadge color={item.color} active={item.key === this.props.active}>{item.text}</StatusBadge>
      </div>
    );
  }

  render(): JSX.Element {
    return (
      <div className="flex_row" style={{
        borderTop: '2px solid #111',
        borderBottom: '2px solid #666',
        padding: '2px',
        overflow: 'hidden'
      }}>
        {this.props.values?.map(this.generateJSXFromItem)}
      </div>
    );
  }
}

export default StatusBar;