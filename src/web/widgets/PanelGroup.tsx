import React from 'react';
import styles from './PanelGroup.module.css';

/** タブ定義 */
export type TabItem = {
  key: string;
  content: React.ReactNode;
};

type PanelGroupProps = {
  tabs: TabItem[];
  /** タブ切り替え時に呼ばれるコールバック。選択されたタブキーを渡す */
  onTabChange?: (key: string) => void;
};
type PanelGroupState = {
  selected: string;
};

/** タブ切り替え UI。tabs で渡されたコンテンツを切り替え表示する。 */
class PanelGroup extends React.Component<PanelGroupProps, PanelGroupState> {
  constructor(props: PanelGroupProps) {
    super(props);
    this.state = { selected: props.tabs[0]?.key ?? '' };

    this.handleClick = this.handleClick.bind(this);
  }

  componentDidMount(): void {
    // 初回レンダリング時に選択タブを通知し、activePanelTabAtom と同期する
    if (!this.state.selected) return;
    this.props.onTabChange?.(this.state.selected);
  }

  private handleClick(event: React.MouseEvent<HTMLElement>) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;
    this.setState({ selected: key });
    this.props.onTabChange?.(key);
  }

  render(): JSX.Element {
    const { tabs } = this.props;
    if (tabs.length === 0) return <></>;

    let selected = this.state.selected;
    if (!tabs.some((t) => t.key === selected)) {
      // 何も選択していなかったら、先頭を選ぶ
      selected = tabs[0].key;
    }
    const selectedContent = tabs.find((t) => t.key === selected)?.content;

    return (
      <div className="flex-elem flex-column">
        <div className={['flex-elem-fix', styles.tablist].join(' ')}>
          {tabs.map((tab) => (
            <div
              key={tab.key}
              data-key={tab.key}
              onClick={this.handleClick}
              className={[
                styles.tab,
                tab.key === selected ? styles.active : '',
              ].join(' ')}
            >
              {tab.key}
            </div>
          ))}
        </div>
        <div className="flex-elem flex-column">{selectedContent}</div>
      </div>
    );
  }
}

export default PanelGroup;
