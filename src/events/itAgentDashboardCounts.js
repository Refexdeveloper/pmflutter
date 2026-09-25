/**
 * Kissflow App Event — IT Agent dashboard load
 * Sets KPI variables from Live IT Service Request report
 */
const user_name = kf.user.Name;
kf.app.setVariable('User_Name', user_name);

const account_id = kf.account._id;
const process_id = 'Live_IT_Service_Request_A00';
const app_id = 'IT_Service_Management_A00';

kf.api(
  `/process-report/2/${account_id}/${process_id}/Live_IT_Service_Request_A00_All_Items?page_number=1&page_size=100&_application_id=${app_id}`,
)
  .then(async (res) => {
    let totalRecordsAgent = 0;
    let openAgents = 0;
    let pendingAgents = 0;
    let completedAgents = 0;

    (res.Data || []).forEach((item) => {
      totalRecordsAgent++;

      const currentStep = item.Column_27XUPVQc7e || '';
      const itemStatus = item.Column_nyHECOMNah || '';

      if (currentStep === 'IT Agent' && itemStatus !== 'Completed') {
        openAgents++;
      }

      if (currentStep === 'IT Agent' && itemStatus === 'On Hold') {
        pendingAgents++;
      }

      if (itemStatus === 'Completed') {
        completedAgents++;
      }
    });

    await Promise.all([
      kf.app.setVariable('total_records_agent', totalRecordsAgent),
      kf.app.setVariable('open_agents', openAgents),
      kf.app.setVariable('pending_agents', pendingAgents),
      kf.app.setVariable('completed_agents', completedAgents),
    ]);
  })
  .catch(async () => {
    await Promise.all([
      kf.app.setVariable('total_records_agent', 0),
      kf.app.setVariable('open_agents', 0),
      kf.app.setVariable('pending_agents', 0),
      kf.app.setVariable('completed_agents', 0),
    ]);
  });
