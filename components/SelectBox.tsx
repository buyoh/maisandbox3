import React from 'react';

type SelectBoxProps = {
  disable?: boolean,
  items?: Array<{ key: string, label: string }>
}

function renderOptionItem(item: { key: string, label: string }) {
  const { key, label } = item;
  return (
    <option value={key} key={key}>{label}</option>
  )
}

class SelectBox extends React.Component<SelectBoxProps, {}> {
  constructor(props: SelectBoxProps) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div style={{ display: 'flex' }}>
        <select
          disabled={this.props.disable}
          style={{
            display: 'block',
            flex: '1'
          }}
        >{this.props.items?.map(renderOptionItem)}</select>
      </div>
    )
  }
}

export default SelectBox;