import React, { ChangeEvent } from 'react';

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
    this.handleChange = this.handleChange.bind(this);
  }

  private handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    this.props.onChange?.(e.target.value);
  }

  render(): JSX.Element {
    return (
      <textarea
        rows={8}
        style={{
          display: 'block',
          width: 'auto',
          height: 'auto',
          flex: '1', // <<< BAD
          resize: 'none'
        }}
        readOnly={this.props.readOnly}
        placeholder={this.props.placeholder}
        onChange={this.handleChange}
        value={this.props.value}
      />
    );
  }
}

export default TextArea;