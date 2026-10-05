const email = 'itsm.test@refex.co.in'
const q = new URLSearchParams({
  page_number: '1',
  page_size: '20',
  user_type: 'User',
  active_user: 'true',
  q: email,
})

async function search(label, path) {
  const res = await fetch(`http://localhost:3000${path}?${q}`, { headers: { Accept: 'application/json' } })
  const data = await res.json().catch(() => ({}))
  const rows = data.Data || data.data || (Array.isArray(data) ? data : [])
  const hit = (Array.isArray(rows) ? rows : []).find((row) => String(row.Email || row.email || '').toLowerCase() === email)
  return {
    label,
    status: res.status,
    error: data.en_message || data.message || '',
    hit: hit ? { id: hit._id, name: hit.Name, email: hit.Email, kind: hit.Kind, status: hit.Status } : null,
    rowCount: Array.isArray(rows) ? rows.length : 0,
  }
}

const live = await search('live', '/kf-live/user/2/AcCMptlq60zH/')
console.log(JSON.stringify({ live }, null, 2))
