import React from 'react';
import { CSSProperties } from 'react';
import HeaderConnectionStatus from '../widgets/HeaderConnectionStatus';

const HeaderStyle: CSSProperties = {
  backgroundColor: '#ccc',
  color: '#222',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const TitleStyle: CSSProperties = {
  padding: '0.5em',
  margin: 0,
  fontSize: '1.2em',
  fontWeight: 'bold',
};

function Header(): JSX.Element {
  return (
    <header style={HeaderStyle} className="flex-elem-fix">
      <h1 style={TitleStyle}>maisandbox3</h1>
      <HeaderConnectionStatus />
    </header>
  );
}

export default Header;
