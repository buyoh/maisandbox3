import React from 'react';
import PropTypes from 'prop-types';
import styles from './PanelGroup.module.css';

type PanelGroupProps = {
  children?: PropTypes.ReactNodeLike;
};
type PanelGroupState = {
  selected: string;
};

class PanelGroup extends React.Component<PanelGroupProps, PanelGroupState> {
  constructor(props: PanelGroupProps) {
    super(props);
    this.state = { selected: 'default' };

    this.handleClick = this.handleClick.bind(this);
  }

  private handleClick(event: React.MouseEvent<HTMLElement>) {
    const key = event.currentTarget.dataset.key as string;
    this.setState({ selected: key });
  }

  render(): JSX.Element {
    const keyElemList = React.Children.map(this.props.children, (e) =>
      e ? { dom: e, key: (e as any).key as string } : null
    )?.filter((e) => e !== null);
    if (!keyElemList || keyElemList.length === 0) return <></>;

    const keyList = keyElemList.map((e) => e.key);
    let selected = this.state.selected;
    console.log(selected, keyList, !keyList.includes(selected));
    if (!keyList.includes(selected)) {
      // 何も選択していなかったら、適当に選んでおく
      selected = keyList[0];
    }
    const selectedElem = keyElemList.find((e) => e.key === selected)?.dom;

    return (
      <div className="flex-elem flex-column">
        <div className={['flex-elem-fix', styles.tablist].join(' ')}>
          {keyList.map((key) => (
            <div
              key={key}
              data-key={key}
              onClick={this.handleClick}
              className={[
                styles.tab,
                key === selected ? styles.active : '',
              ].join(' ')}
            >
              {key}
            </div>
          ))}
        </div>
        <div className="flex-elem">{selectedElem}</div>
      </div>
    );
  }
}

export default PanelGroup;
