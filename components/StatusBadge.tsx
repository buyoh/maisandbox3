import React from 'react';

type StatusBadgeProps = {
  color: string
}

type StatusBadgeState = {
}


class StatusBadge extends React.Component<StatusBadgeProps, StatusBadgeState> {
  constructor(props: StatusBadgeProps) {
    super(props);
  }

  render(): JSX.Element {
    return (
      <div
        className={'color-' + this.props.color}
        style={{
          textAlign: 'center',
          padding: '0.25em 0.5em',
          borderRadius: '0.5em',
          marginRight: '0.25em'
        }}
      >
        {this.props.children}
      </div>
    );
  }
}

export default StatusBadge;