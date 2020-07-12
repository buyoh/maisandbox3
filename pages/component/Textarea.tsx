import React from "react";
// import { CSSProperties } from 'react';

type TextAreaProps = {
  value?: string,
  onChange?: (string) => void
}

type TextAreaState = {
}


class TextArea extends React.Component<TextAreaProps, TextAreaState> {
  constructor(props: TextAreaProps) {
    super(props);
  }

  render() {
    return (
      <div style={{ display: 'flex' }}>
        <textarea
          rows={8}
          style={{
            display: 'block',
            width: 'auto',
            height: 'auto',
            flex: '1',
          }}
          onChange={this.props.onChange ? (e) => (this.props.onChange(e.target.value)) : () => { }}
          value={this.props.value}
        />
      </div>
    )
  }
}

export default TextArea;