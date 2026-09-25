/**
 * Kissflow App Event — run on dashboard load
 * Sets KPI app variables from Live IT Service Request report (requester's own records)
 */
const user_name = kf.user.Name;
const account_id = kf.account._id;
const process_id = 'Live_IT_Service_Request_A00';
const app_id = 'IT_Service_Management_A00';

function isSlaBreached(item) {
  const itemStatus = String(item.Column_nyHECOMNah || '').toLowerCase();
  if (itemStatus.includes('breach')) return true;

  const status = String(item.Column_vlunW1aLEU || '').toLowerCase().trim();
  if (status === 'completed' || status === 'closed') return false;

  const slaMinutes = Number(item.Column_c9k71UiWFq);
  if (!Number.isFinite(slaMinutes) || slaMinutes <= 0) return false;

  const startTime = item['Column_T2P0u0D-sw'] || item.Column_QOwvoXvcys;
  if (!startTime) return false;

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return false;

  const elapsedMinutes = (Date.now() - start.getTime()) / (1000 * 60);
  return elapsedMinutes > slaMinutes;
}

kf.app.setVariable('User_Name', user_name);

kf.api(
  `/process-report/2/${account_id}/${process_id}/Live_IT_Service_Request_A00_All_Items?page_number=1&page_size=100&_application_id=${app_id}`,
)
  .then(async (res) => {
    let totalRecords = 0;
    let openTickets = 0;
    let completedRecords = 0;
    let slaBreached = 0;

    const loggedInEmail = (kf.user.Email || '').toLowerCase().trim();

    (res.Data || []).forEach((item) => {
      const requesterEmail = (item.Column_d6WEUYBK5K || '').toLowerCase().trim();

      if (requesterEmail !== loggedInEmail) {
        return;
      }

      totalRecords++;

      const status = (item.Column_vlunW1aLEU || '').toLowerCase().trim();

      if (status === 'inprogress' || status === 'open') {
        openTickets++;
      }

      if (status === 'completed' || status === 'closed') {
        completedRecords++;
      }

      if (isSlaBreached(item)) {
        slaBreached++;
      }
    });

    await Promise.all([
      kf.app.setVariable('total_records', totalRecords),
      kf.app.setVariable('open_tickets', openTickets),
      kf.app.setVariable('completed_records', completedRecords),
      kf.app.setVariable('sla_breached', slaBreached),
    ]);
  })
  .catch(async (err) => {
    console.error(err);

    await Promise.all([
      kf.app.setVariable('total_records', 0),
      kf.app.setVariable('open_tickets', 0),
      kf.app.setVariable('completed_records', 0),
      kf.app.setVariable('sla_breached', 0),
    ]);
  });
