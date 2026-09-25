import { MOCK_IT_REPORT } from './itServiceRequests.js';

/** Preview user — IT agent with tasks at IT Agent step */
export const MOCK_IT_AGENT_USER = {
  _id: 'UsCw2I27fXaf',
  Name: 'Karthikaa',
  Email: 'karthikaa@kissflow.com',
};

export const MOCK_IT_AGENT_TASKS = {
  Data: (MOCK_IT_REPORT.Data || []).filter((item) => {
    const step = String(item.Column_27XUPVQc7e || '').trim();
    const itemStatus = String(item.Column_nyHECOMNah || '').trim();
    const lastStep = String(item.Column_ZBd4KxwpW2 || '').trim();
    return step === 'IT Agent' || itemStatus === 'Completed' || lastStep === 'IT Agent';
  }),
};
