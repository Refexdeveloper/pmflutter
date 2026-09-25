/**
 * Kissflow App Event — IT Manager dashboard load
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
    let totalManager = 0;
    let openManager = 0;
    let completedManager = 0;
    let pendingManager = 0;
    let pendingFullManager = 0;

    (res.Data || []).forEach((item) => {
      totalManager++;

      const currentStep = item.Column_27XUPVQc7e || '';
      const itemStatus = (item.Column_nyHECOMNah || '').toLowerCase().trim();

      if (itemStatus === 'completed') {
        completedManager++;
      }

      if (itemStatus !== 'completed') {
        openManager++;
      }

      if (currentStep === 'IT Manager') {
        pendingManager++;
      }

      if (currentStep === 'IT Agent') {
        pendingFullManager++;
      }
    });

    await Promise.all([
      kf.app.setVariable('total_manager', totalManager),
      kf.app.setVariable('open_manager', openManager),
      kf.app.setVariable('completed_manager', completedManager),
      kf.app.setVariable('pending_manager', pendingManager),
      kf.app.setVariable('pending_full_manager', pendingFullManager),
    ]);
  })
  .catch(async (err) => {
    console.error('Manager Dashboard Error:', err);

    await Promise.all([
      kf.app.setVariable('total_manager', 0),
      kf.app.setVariable('open_manager', 0),
      kf.app.setVariable('completed_manager', 0),
      kf.app.setVariable('pending_manager', 0),
      kf.app.setVariable('pending_full_manager', 0),
    ]);
  });
