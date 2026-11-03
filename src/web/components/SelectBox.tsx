import React from 'react';

type SelectBoxProps = {
  value: string;
  /** true の場合セレクトボックスを無効化する。省略時は有効。 */
  disable?: boolean;
  /** 選択肢一覧。省略時は空のセレクトボックスを表示。 */
  items?: Array<{ key: string; label: string }>;
  /** 選択変更時のコールバック。省略時は変更通知を受け取らない。 */
  onChange?: (key: string) => void;
};

function renderOptionItem(item: { key: string; label: string }) {
  const { key, label } = item;
  return (
    <option value={key} key={key}>
      {label}
    </option>
  );
}

class SelectBox extends React.Component<SelectBoxProps, {}> {
  constructor(props: SelectBoxProps) {
    super(props);
    this.state = {};
    this.handleChange = this.handleChange.bind(this);
  }

  private handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const val = event.target.value;
    this.props.onChange?.call(null, val);
  }

  render(): JSX.Element {
    return (
      <div style={{ display: 'flex' }}>
        <select
          disabled={this.props.disable}
          style={{
            display: 'block',
            flex: '1',
          }}
          value={this.props.value}
          onChange={this.handleChange}
        >
          {this.props.items?.map(renderOptionItem)}
        </select>
      </div>
    );
  }
}

export default SelectBox;
