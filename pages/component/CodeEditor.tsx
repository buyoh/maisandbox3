import React from "react";
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/mode-c_cpp";
import "ace-builds/src-min-noconflict/mode-python";
import "ace-builds/src-min-noconflict/mode-ruby";
import "ace-builds/src-min-noconflict/mode-sh";

import "ace-builds/src-min-noconflict/theme-monokai";

import "ace-builds/src-min-noconflict/ext-language_tools";
import "ace-builds/src-min-noconflict/ext-whitespace"; // ??
import "ace-builds/src-min-noconflict/ext-beautify"; // ??
import "ace-builds/src-min-noconflict/ext-options"; // ??

type CodeEditorProps = {
  lang: string
  value: string
  onChange: (value: string) => void
}

type CodeEditorState = {
  value: string;
}

// import "ace-builds/src-noconflict/mode-c_cpp";
// import "ace-builds/src-noconflict/theme-github";

// <AceEditor
// mode="c_cpp"
// theme="monokai"
// />


class CodeEditor extends React.Component<CodeEditorProps, CodeEditorState> {
  constructor(props: CodeEditorProps) {
    super(props);
    this.state = { value: '' };
  }

  render() {
    return (
      <AceEditor
        mode={this.props.lang}
        theme='monokai'
        editorProps={{
          $blockScrolling: true,
        }}
        setOptions={{
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
        value={this.props.value}
        onChange={(v) => this.props.onChange(v)}
      />
    )
  }
}

export default CodeEditor;