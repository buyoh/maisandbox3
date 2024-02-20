import React from 'react';

import SelectBox from './SelectBox';

type LangSettingsCppProps = {
  std: string;
  onLangChange?: (lang: string) => void;
};

class LangSettingsCpp extends React.Component<LangSettingsCppProps, {}> {
  constructor(props: LangSettingsCppProps) {
    super(props);
    this.state = {};
  }

  render(): JSX.Element {
    return (
      <div className="flex-row">
        <div className="flex-elem-fix">
          <div style={{ width: '6ch', textAlign: 'center' }}>-std= </div>
        </div>
        <div className="flex-elem">
          <SelectBox
            value={this.props.std}
            items={[
              { key: 'c++14', label: 'c++14' },
              { key: 'c++17', label: 'c++17' },
            ]}
            onChange={this.props.onLangChange}
          />
        </div>
      </div>
    );
  }
}

export default LangSettingsCpp;
