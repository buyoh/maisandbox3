import React from 'react';

import TextArea from './Textarea';

class StaticIOEditor extends React.Component<{}, { stdin: string, stdout: string }> {
  constructor(props: {}) {
    super(props);
    this.state = { stdin: '', stdout: '' };
  }

  getStdin(): string {
    return this.state.stdin;
  }

  setStdout(value: string) {
    this.setState(Object.assign({}, this.state, { stdout: value }));
  }

  render() {
    return (
      <div className="flex_row">
        <div className="flex_elem border">
          <TextArea value={this.state.stdin}
            onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdin: txt })))}
          />
        </div>
        <div className="flex_elem border">
          <TextArea value={this.state.stdout}
            onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdout: txt })))} />
        </div>
      </div>
    )
  }
}

export default StaticIOEditor;