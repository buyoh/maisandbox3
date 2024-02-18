import React from 'react';

import SelectBox from './SelectBox';
import LangSettingsCpp from './LangSettingsCpp';
import TemplateLoaderPanelProps from './TemplateLoaderPanel';

type CodeToolbarProps = {
  lang: string;
  onLangChange: (lang: string) => void;
  onClickPull: () => void;
  onClickPush: () => void;
};

class CodeToolbar extends React.Component<CodeToolbarProps, {}> {
  constructor(props: CodeToolbarProps) {
    super(props);
    this.state = {};
  }

  render(): JSX.Element {
    return (
      <div className="flex-elem flex-row">
        <div className="flex-elem">
          <SelectBox
            value={this.props.lang}
            items={[
              { key: 'ruby', label: 'Ruby' },
              { key: 'python', label: 'Python' },
              { key: 'cpp', label: 'C++' },
              { key: 'clay', label: 'cLay' },
            ]}
            onChange={this.props.onLangChange}
          />
        </div>
        {this.props.lang == 'cpp' && (
          <div className="flex-elem-fix">
            <LangSettingsCpp std={'c++17'} />
          </div>
        )}
        <div className="flex-elem-fix">
          <TemplateLoaderPanelProps
            onClickPull={this.props.onClickPull}
            onClickPush={this.props.onClickPush}
          />
        </div>
      </div>
    );
  }
}

export default CodeToolbar;
