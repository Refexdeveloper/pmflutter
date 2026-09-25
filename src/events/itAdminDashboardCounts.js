/**
 * Kissflow App Event — IT Admin dashboard load
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
    let totalAdmin = 0;
    let openAdmin = 0;
    let completedAdmin = 0;
    let pendingAdmin = 0;

    (res.Data || []).forEach((item) => {
      totalAdmin++;

      const currentStep = item.Column_27XUPVQc7e || '';
      const itemStatus = (item.Column_nyHECOMNah || '').toLowerCase().trim();
      const workflowStatus = (item.Column_vlunW1aLEU || item.Column_McylhavuPn || '').toLowerCase().trim();
      const isDraft = workflowStatus === 'draft';
      const isCompleted = itemStatus === 'completed' || workflowStatus === 'completed';

      if (isCompleted) completedAdmin++;
      if (!isCompleted && !isDraft) openAdmin++;
      if (!isCompleted && !isDraft && (currentStep === 'IT Agent' || currentStep === 'IT Manager')) {
        pendingAdmin++;
      }
    });

    await Promise.all([
      kf.app.setVariable('total_admin', totalAdmin),
      kf.app.setVariable('open_admin', openAdmin),
      kf.app.setVariable('completed_admin', completedAdmin),
      kf.app.setVariable('pending_admin', pendingAdmin),
    ]);
  })
  .catch(async (err) => {
    console.error('Admin Dashboard Error:', err);
    await Promise.all([
      kf.app.setVariable('total_admin', 0),
      kf.app.setVariable('open_admin', 0),
      kf.app.setVariable('completed_admin', 0),
      kf.app.setVariable('pending_admin', 0),
    ]);
  });
