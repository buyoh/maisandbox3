import React from 'react';
import { ReportItem } from '../../lib/type';
import styles from './StatusDetail.module.css';

type StatusDetailProps = {
  details: ReportItem[];
};

type StatusDetailState = {};

function ConvertReportItemToElement(item: ReportItem): JSX.Element {
  // TODO: Add style.
  if (item.type === 'text') {
    return (
      <div
        key={`text-${item.title}`}
        className={[styles.item, styles.item_text].join(' ')}
      >
        <div className={[styles.title].join(' ')}>{item.title}</div>
        <textarea className={[styles.text].join(' ')}>{item.text}</textarea>
      </div>
    );
  } else if (item.type === 'param') {
    return (
      <div
        key={`prm-${item.key}`}
        className={[styles.item, styles.item_param].join(' ')}
      >
        <div className={[styles.key].join(' ')}>{item.key}</div>
        <div className={[styles.value].join(' ')}>
          <code>{JSON.stringify(item.value)}</code>
        </div>
      </div>
    );
  } else {
    return <></>;
  }
}

class StatusDetail extends React.Component<
  StatusDetailProps,
  StatusDetailState
> {
  constructor(props: StatusDetailProps) {
    super(props);
  }

  render(): JSX.Element {
    return <div>{this.props.details.map(ConvertReportItemToElement)}</div>;
  }
}

export default StatusDetail;
