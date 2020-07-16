import React from 'react';

class Launcher extends React.Component<{}, { stdin: string, stdout: string }> {
  constructor(props: {}) {
    super(props);
    this.state = { stdin: '', stdout: '' };
  }

  render() {
    return (
      <div className="flex_row">
        <div className="flex_elem border">
          <TextArea value={this.state.stdin}
            onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdin: txt, stdout: txt })))}
          />
        </div>
        <div className="flex_elem border">
          <TextArea value={this.state.stdout} />
        </div>
      </div>
    )
  }
}

export default Launcher;