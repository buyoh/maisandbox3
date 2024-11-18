import React from 'react';
import AceEditor from 'react-ace';

import { Annotation } from '../../interfaces/ResultTypes';

import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-ruby';

import 'ace-builds/src-noconflict/snippets/c_cpp';
import 'ace-builds/src-noconflict/snippets/python';
import 'ace-builds/src-noconflict/snippets/ruby';

import 'ace-builds/src-noconflict/theme-monokai';

import 'ace-builds/src-noconflict/ext-language_tools';
import 'ace-builds/src-noconflict/ext-whitespace'; // ??
import 'ace-builds/src-noconflict/ext-beautify'; // ??
import 'ace-builds/src-noconflict/ext-options'; // ??
// import 'ace-builds/src-noconflict/ext-emmet';

type CodeEditorProps = {
  lang: string;
  value: string;
  onChange?: (value: string) => void;
  annotations?: Annotation[];
};

type CodeEditorState = {};

// import 'ace-builds/src-noconflict/theme-github';

class CodeEditor extends React.Component<CodeEditorProps, CodeEditorState> {
  constructor(props: CodeEditorProps) {
    super(props);
    this.state = { value: '' };
    this.handleOnChange = this.handleOnChange.bind(this);
  }

  private handleOnChange(value: string): void {
    this.props.onChange?.(value);
  }

  render(): JSX.Element {
    const annotations = this.props.annotations?.map((a) => {
      console.log(a.type);
      return {
        row: a.row,
        column: a.column,
        text: a.text,
        type: a.type === 'error' ? 'error' : 'warning', // TODO: Other type?
      };
    });
    return (
      <AceEditor
        mode={this.props.lang}
        theme="monokai"
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
          enableLiveAutocompletion: true,
        }}
        fontSize="1.4rem"
        tabSize={2}
        style={{
          display: 'block',
        }}
        width="auto"
        height="100%"
        annotations={annotations}
        value={this.props.value}
        onChange={this.handleOnChange}
      />
    );
  }
}

export default CodeEditor;
