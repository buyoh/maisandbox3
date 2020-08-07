import React from 'react';

type TextAreaProps = {
  value?: string,
  onChange?: (string) => void
  placeholder?: string,
  readOnly?: boolean
}

type TextAreaState = {
}


class TextArea extends React.Component<TextAreaProps, TextAreaState> {
  constructor(props: TextAreaProps) {
    super(props);
  }

  render(): JSX.Element {
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
          readOnly={this.props.readOnly}
          placeholder={this.props.placeholder}
          onChange={this.props.onChange}
          value={this.props.value}
        />
      </div>
    );
  }
}

export default TextArea;