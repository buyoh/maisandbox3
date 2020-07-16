import React from 'react';

import SelectBox from './SelectBox';

type CodeToolbarProps = {
}

class CodeToolbar extends React.Component<CodeToolbarProps, {}> {
  constructor(props: CodeToolbarProps) {
    super(props);
    this.state = {};

  }

  render() {
    return (
      <div className="">
        <SelectBox items={[{ value: 'ruby', label: 'Ruby' }, { value: 'python', label: 'Python' }]} />
      </div>
    )
  }
}

export default CodeToolbar;