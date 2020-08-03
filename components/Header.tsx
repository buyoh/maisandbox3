import { CSSProperties } from 'react';

const HeaderStyle: CSSProperties = {
  backgroundColor: '#ccc',
  color: '#222'
};

const TitleStyle: CSSProperties = {
  padding: '0.5em',
  margin: 0,
  fontSize: '1.2em',
  fontWeight: 'bold'
};

export default (): JSX.Element => (
  <header style={HeaderStyle}>
    <h1 style={TitleStyle}>maisandbox3</h1>
  </header>
);