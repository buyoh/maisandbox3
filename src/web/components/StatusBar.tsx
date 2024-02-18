import React from 'react';
import StatusBadge from './StatusBadge';

type ClickHandler = (key: string) => void;
type Key = string;
export type Item = {
  color: string;
  text: string;
  key: Key;
  onClick?: ClickHandler;
};

type StatusBarProps = {
  values: Array<Item>;
  active?: Key;
};

type StatusBarState = {};

class StatusBar extends React.Component<StatusBarProps, StatusBarState> {
  constructor(props: StatusBarProps) {
    super(props);
    this.generateJSXFromItem = this.generateJSXFromItem.bind(this);
  }

  private generateJSXFromItem(item: Item): JSX.Element {
    return (
      <div
        className="flex-elem-fix"
        key={item.key}
        onClick={() => {
          item.onClick?.call(null, item.key);
        }}
      >
        <StatusBadge
          color={item.color}
          active={item.key === this.props.active}
          clickable={!!item.onClick}
        >
          {item.text}
        </StatusBadge>
      </div>
    );
  }

  render(): JSX.Element {
    // TODO: StatusBar の高さが一定でない
    // TODO: ステータスの数が溢れた場合の考慮が無い
    return (
      <div
        className="flex-row"
        style={{
          borderTop: '2px solid #111',
          borderBottom: '2px solid #666',
          padding: '2px',
          overflow: 'hidden',
        }}
      >
        {this.props.values?.map(this.generateJSXFromItem)}

        <div
          // Status が空であっても一定の高さを保つためのダミー
          className="flex-elem-fix"
          key={'_tail'}
        >
          <StatusBadge color={'gray'} active={false} clickable={false}>
            {'>_<'}
          </StatusBadge>
        </div>
      </div>
    );
  }
}

export default StatusBar;
