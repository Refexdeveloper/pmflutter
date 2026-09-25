import { useState } from 'react'
import type { Asset, AssetStatus } from '@eam/mocks/assets'
import { companies, locations, categories } from '@eam/mocks/companies'
import { useAppContext } from '@eam/context/AppContext'

interface Props {
  onClose: () => void
  editAsset?: Asset | null
}

export const AssetForm = ({ onClose, editAsset }: Props) => {
  const { addToast } = useAppContext()
  const [companyId, setCompanyId] = useState(editAsset?.companyId || '')
  const [locationId, setLocationId] = useState(editAsset?.locationId || '')
  const [categoryId, setCategoryId] = useState(editAsset?.categoryId || '')
  const [name, setName] = useState(editAsset?.name || '')
  const [purchaseDate, setPurchaseDate] = useState(editAsset?.purchaseDate || '')
  const [value, setValue] = useState(editAsset?.value?.toString() || '')
  const [vendor, setVendor] = useState(editAsset?.vendorName || '')
  const [warrantyExpiry, setWarrantyExpiry] = useState(editAsset?.warrantyExpiry || '')
  const [status, setStatus] = useState<AssetStatus>(editAsset?.status || 'Available')

  const filteredLocations = companyId ? locations.filter((l) => l.companyId === companyId) : []

  const generateAssetId = () => {
    if (!companyId || !locationId || !categoryId) return 'Select company, location & category'
    const comp = companies.find((c) => c.id === companyId)
    const loc = locations.find((l) => l.id === locationId)
    const cat = categories.find((c) => c.id === categoryId)
    return `${comp?.code}-${loc?.code}-${cat?.code}-XXXX`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addToast(editAsset ? 'Asset updated successfully' : 'Asset added successfully', 'success')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4" style={{ background: '#023957' }}>
          <h2 className="text-sm font-semibold text-white">{editAsset ? 'Edit Asset' : 'Add New Asset'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <i className="ri-close-line text-base" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid max-h-[70vh] grid-cols-2 gap-4 overflow-y-auto p-6">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Asset ID (Auto-generated)</label>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm font-medium text-secondary">
              {generateAssetId()}
            </div>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Asset Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Dell Latitude 5540"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Company *</label>
            <select
              required
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value)
                setLocationId('')
              }}
              className="w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select Company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Location *</label>
            <select
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select Location</option>
              {filteredLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Category *</label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              className="w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="Available">Available</option>
              <option value="Assigned">Assigned</option>
              <option value="Lost">Lost</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Purchase Date *</label>
            <input
              required
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Asset Value (₹) *</label>
            <input
              required
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. 75000"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Vendor Name *</label>
            <input
              required
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Dell Technologies"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Warranty Expiry *</label>
            <input
              required
              type="date"
              value={warrantyExpiry}
              onChange={(e) => setWarrantyExpiry(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer whitespace-nowrap rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer whitespace-nowrap rounded-lg px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: '#023957' }}
            >
              {editAsset ? 'Update Asset' : 'Add Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

