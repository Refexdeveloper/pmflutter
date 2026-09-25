import { useState } from 'react'
import { assets, type Asset } from '@eam/mocks/assets'
import { AssetTable } from './components/AssetTable'
import { AssetForm } from './components/AssetForm'
import { BulkUpload } from './components/BulkUpload'

const AssetMasterPage = () => {
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)

  const handleEdit = (asset: Asset) => {
    setEditAsset(asset)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditAsset(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Asset Master</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage all enterprise assets across companies and locations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBulk(true)}
            className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-secondary/30 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/5"
          >
            <i className="ri-upload-2-line text-sm" aria-hidden />
            Bulk Upload
          </button>
          <button
            type="button"
            onClick={() => {
              setEditAsset(null)
              setShowForm(true)
            }}
            className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: '#023957' }}
          >
            <i className="ri-add-line text-sm" aria-hidden />
            Add Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: assets.length, color: '#023957' },
          { label: 'Available', value: assets.filter((a) => a.status === 'Available').length, color: '#15803d' },
          { label: 'Assigned', value: assets.filter((a) => a.status === 'Assigned').length, color: '#145d7c' },
          {
            label: 'Lost / Maint.',
            value: assets.filter((a) => a.status === 'Lost' || a.status === 'Maintenance').length,
            color: '#dc2626',
          },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
            <span className="text-xl font-bold" style={{ color: s.color }}>
              {s.value}
            </span>
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      <AssetTable assets={assets} onEdit={handleEdit} />

      {showForm ? <AssetForm onClose={handleCloseForm} editAsset={editAsset} /> : null}
      {showBulk ? <BulkUpload onClose={() => setShowBulk(false)} /> : null}
    </div>
  )
}

export default AssetMasterPage

