import React from 'react';
import styles from './StatusBadge.module.css';

type StatusBadgeProps = {
  color: string
  active?: boolean
  clickable?: boolean
}

type StatusBadgeState = {
}

class StatusBadge extends React.Component<StatusBadgeProps, StatusBadgeState> {
  constructor(props: StatusBadgeProps) {
    super(props);
  }
  render(): JSX.Element {
    const klass = ['color-' + this.props.color, styles.status];
    if (this.props.active) klass.push(styles.active);
    if (this.props.clickable) klass.push(styles.clickable);
    return (
      <div className={klass.join(' ')}>
        {this.props.children}
      </div>
    );
  }
}

export default StatusBadge;