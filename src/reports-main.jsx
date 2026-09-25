import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import ProjectReportsPage from './ProjectReportsPage.jsx';
import { SDKWrapper } from './sdk/index.js';

function resolveMountNode() {
  const existing = document.getElementById('root') || document.getElementById('app');
  if (existing) return existing;
  const created = document.createElement('div');
  created.id = 'root';
  document.body.appendChild(created);
  return created;
}

createRoot(resolveMountNode()).render(
  <StrictMode>
    <SDKWrapper>
      <ProjectReportsPage />
    </SDKWrapper>
  </StrictMode>,
);

