import React from 'react';

import SelectBox from './SelectBox';

type CodeToolbarProps = {
  lang: string
  onLangChange?: (lang: string) => void
}

class CodeToolbar extends React.Component<CodeToolbarProps, {}> {
  constructor(props: CodeToolbarProps) {
    super(props);
    this.state = {};

  }

  render() {
    return (
      <div className="">
        <SelectBox
          value={this.props.lang}
          items={[
            { key: 'ruby', label: 'Ruby' },
            { key: 'python', label: 'Python' },
            { key: 'cpp', label: 'C++' }]}
          onChange={this.props.onLangChange}
        />
      </div>
    )
  }
}

export default CodeToolbar;