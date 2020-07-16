import React from 'react';

type SelectBoxProps = {
  disable?: boolean,
  items?: Array<{ value: string, label: string }>
}

function renderOptionItem(item: { value: string, label: string }) {
  const { value, label } = item;
  return (
    <option value={value}>{label}</option>
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