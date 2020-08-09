import React from 'react';
import AceEditor from 'react-ace';

import 'ace-builds/src-min-noconflict/mode-c_cpp';
import 'ace-builds/src-min-noconflict/mode-python';
import 'ace-builds/src-min-noconflict/mode-ruby';

import 'ace-builds/src-noconflict/snippets/c_cpp';
import 'ace-builds/src-noconflict/snippets/python';
import 'ace-builds/src-noconflict/snippets/ruby';

import 'ace-builds/src-min-noconflict/theme-monokai';

import 'ace-builds/src-min-noconflict/ext-language_tools';
import 'ace-builds/src-min-noconflict/ext-whitespace'; // ??
import 'ace-builds/src-min-noconflict/ext-beautify'; // ??
import 'ace-builds/src-min-noconflict/ext-options'; // ??
// import 'ace-builds/src-min-noconflict/ext-emmet';

type CodeEditorProps = {
  lang: string
  onChange?: (value: string) => void
}

type CodeEditorState = {
  value: string;
}

// import 'ace-builds/src-noconflict/mode-c_cpp';
// import 'ace-builds/src-noconflict/theme-github';


class CodeEditor extends React.Component<CodeEditorProps, CodeEditorState> {
  constructor(props: CodeEditorProps) {
    super(props);
    this.state = { value: '' };
    this.handleOnChange = this.handleOnChange.bind(this);
  }

  private handleOnChange(value: string): void {
    this.setState(Object.assign({}, this.props, { value }));
    this.props.onChange?.(value);
  }

  getValue(): string {
    return this.state.value;
  }

  setValue(value: string): void {
    this.setState(Object.assign({}, this.state, { value }));
  }

  render(): JSX.Element {
    return (
      <AceEditor
        mode={this.props.lang}
        theme='monokai'
        editorProps={{
          $blockScrolling: true,

        }}
        setOptions={{
          animatedScroll: false,
          showInvisibles: true,
          printMargin: true,
          printMarginColumn: 100,
          enableBasicAutocompletion: true,
          enableSnippets: true,
          enableLiveAutocompletion: true
        }}
        fontSize='1.4rem'
        tabSize={2}
        style={{
          display: 'block',
          width: 'auto'
        }}
        value={this.state.value}
        onChange={this.handleOnChange}

      />
    );
  }
}

export default CodeEditor;