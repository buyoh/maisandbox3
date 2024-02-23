import React from 'react';
import Head from 'next/head';

// TODO: Only used for nextjs, remove for vite
export default function Meta(): JSX.Element {
  return (
    <Head>
      <title>maisandbox</title>
      <link rel="icon" href="/icons/787_me_f.svg" />
    </Head>
  );
}
Meta.displayName = 'Meta';
