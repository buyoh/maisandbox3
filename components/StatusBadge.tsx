import React from 'react';

type StatusBadgeProps = {
  color: string
  active?: boolean
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
          marginRight: '0.25em',
          outlineOffset: '-2px',
          outline: (this.props.active ? '3px solid #ffe8' : undefined)
        }}
      >
        {this.props.children}
      </div>
    );
  }
}

export default StatusBadge;