import React from 'react';
import PropTypes from 'prop-types';

type ButtonProps = {
  disable?: boolean;
  onClick: () => void;
  children?: PropTypes.ReactNodeLike;
};

type ButtonState = {};

class Button extends React.Component<ButtonProps, ButtonState> {
  constructor(props: ButtonProps) {
    super(props);
  }

  render(): JSX.Element {
    return (
      <div className="flex-row">
        <button
          className="flex-elem"
          disabled={this.props.disable}
          style={{
            display: 'block',
          }}
          onClick={() => this.props.onClick()}
        >
          {this.props.children}
        </button>
      </div>
    );
  }
}

export default Button;
