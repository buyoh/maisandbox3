import React, { useCallback, useRef } from 'react';

import { useAtom, useAtomValue } from 'jotai';
import CodeToolbar from '../components/CodeToolbar';
import CodeEditor from '../components/CodeEditor';
import { LangVersionInfoConnected } from '../widgets/LangVersionInfo';
import {
  pullFromLocalStorage,
  pushToLocalStorage,
} from '../services/local-storage';
import type { Annotation } from '../../interfaces/result-types';
import {
  codeAtom,
  langAtom,
  annotationsAtom,
} from '../stores/code-editor-atoms';

const converterKey2Style: { [key: string]: string } = {
  cpp: 'c_cpp',
  ruby: 'ruby',
  python: 'python',
  clay: 'c_cpp',
};

export default function CodeEditorShell(): JSX.Element {
  const [code, setCode] = useAtom(codeAtom);
  const [lang, setLang] = useAtom(langAtom);
  const annotations = useAtomValue(annotationsAtom);
  const refCodeEditor = useRef<CodeEditor>(null);

  const handleTemplatePull = useCallback(() => {
    const li = pullFromLocalStorage('templates');
    if (!li) return;
    if (!li[lang]) return;
    setCode(li[lang]);
  }, [lang, setCode]);

  const handleTemplatePush = useCallback(() => {
    let li = pullFromLocalStorage('templates');
    if (!li) li = {};
    li[lang] = code;
    pushToLocalStorage('templates', li);
  }, [lang, code]);

  return (
    <div className="flex-elem flex-column">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CodeToolbar
          lang={lang}
          onLangChange={setLang}
          onClickPull={handleTemplatePull}
          onClickPush={handleTemplatePush}
        />
        <LangVersionInfoConnected />
      </div>
      <div className="border flex-elem" style={{ height: '100%' }}>
        <CodeEditor
          value={code}
          onChange={setCode}
          ref={refCodeEditor}
          lang={converterKey2Style[lang] || ''}
          annotations={annotations}
        />
      </div>
    </div>
  );
}
