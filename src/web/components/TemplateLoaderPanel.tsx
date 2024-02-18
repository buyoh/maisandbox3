import React from 'react';

import Button from './Button';

type TemplateLoaderPanelProps = {
  onClickPull: () => void;
  onClickPush: () => void;
};

class TemplateLoaderPanel extends React.Component<
  TemplateLoaderPanelProps,
  {}
> {
  constructor(props: TemplateLoaderPanelProps) {
    super(props);
    this.state = {};
  }

  render(): JSX.Element {
    return (
      <div className="flex-row">
        <div className="flex-elem">
          <Button onClick={this.props.onClickPush}>▲</Button>
        </div>
        <div className="flex-elem">
          <Button onClick={this.props.onClickPull}>▼</Button>
        </div>
      </div>
    );
  }
}

export default TemplateLoaderPanel;
