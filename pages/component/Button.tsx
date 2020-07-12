import React from "react";
// import { CSSProperties } from 'react';

type ButtonProps = {
  value: string,
  disable?: boolean,
  onClick: () => void,
}

type ButtonState = {
}


class Button extends React.Component<ButtonProps, ButtonState> {
  constructor(props: ButtonProps) {
    super(props);
  }

  render() {
    return (
      <div>
        <button
          disabled={this.props.disable}
          style={{
            display: 'block',
          }}
          onClick={(e) => (this.props.onClick())}
        >{this.props.value}</button>
      </div>
    )
  }
}

export default Button;