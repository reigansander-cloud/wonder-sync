// =============================================================================
// LAST step, after the new site works and your data is moved: replace
// src/App.jsx in the OLD Base44 project with this file and set NEW_SITE.
// Anyone opening the old address (including a lobby or game link) is sent to
// the same page on the new site.
// =============================================================================
import React, { useEffect } from 'react';

const NEW_SITE = 'https://reigansander-cloud.github.io/wonder-sync'; // no trailing slash

const DROP_PARAMS = ['access_token', 'clear_access_token', 'app_id', 'app_base_url', 'functions_version', 'from_url'];

function target() {
  const params = new URLSearchParams(window.location.search);
  DROP_PARAMS.forEach((p) => params.delete(p));
  const q = params.toString();
  return `${NEW_SITE}${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
}

export default function App() {
  useEffect(() => { window.location.replace(target()); }, []);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0a09', color: '#fde68a', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Wonder Sync has moved</h1>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>Taking you to the new site…</p>
        <a href={target()} style={{ color: '#f59e0b' }}>{NEW_SITE.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  );
}
