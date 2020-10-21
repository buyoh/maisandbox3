import React from 'react';
import { CSSProperties } from 'react';

const HeaderStyle: CSSProperties = {
  backgroundColor: '#ccc',
  color: '#222',
};

const TitleStyle: CSSProperties = {
  padding: '0.5em',
  margin: 0,
  fontSize: '1.2em',
  fontWeight: 'bold',
};

function Header(): JSX.Element {
  return (
    <header style={HeaderStyle}>
      <h1 style={TitleStyle}>maisandbox3</h1>
    </header>
  );
}

export default Header;
