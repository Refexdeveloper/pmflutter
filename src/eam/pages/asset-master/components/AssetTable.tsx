import { useState } from 'react'
import type { Asset, AssetStatus } from '@eam/mocks/assets'
import { companies, locations, categories } from '@eam/mocks/companies'
import { useAppContext } from '@eam/context/AppContext'

const STATUS_STYLES: Record<AssetStatus, string> = {
  Available: 'bg-green-50 text-green-700',
  Assigned: 'bg-blue-50 text-blue-700',
  Lost: 'bg-red-50 text-red-700',
  Maintenance: 'bg-amber-50 text-amber-700',
}

interface Props {
  assets: Asset[]
  onEdit?: (asset: Asset) => void
}

export const AssetTable = ({ assets, onEdit }: Props) => {
  const { addToast } = useAppContext()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const PAGE_SIZE = 8

  const availableLocations = filterCompany ? locations.filter((l) => l.companyId === filterCompany) : locations

  const filtered = assets.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.assetId.toLowerCase().includes(q) ||
      a.vendorName.toLowerCase().includes(q)
    const matchCompany = !filterCompany || a.companyId === filterCompany
    const matchLocation = !filterLocation || a.locationId === filterLocation
    const matchCategory = !filterCategory || a.categoryId === filterCategory
    const matchStatus = !filterStatus || a.status === filterStatus
    return matchSearch && matchCompany && matchLocation && matchCategory && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
        <div className="relative min-w-[200px] flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" aria-hidden />
          <input
            type="text"
            placeholder="Search asset, ID, vendor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <select
          value={filterCompany}
          onChange={(e) => {
            setFilterCompany(e.target.value)
            setFilterLocation('')
            setPage(1)
          }}
          className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterLocation}
          onChange={(e) => {
            setFilterLocation(e.target.value)
            setPage(1)
          }}
          className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All Locations</option>
          {availableLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value)
            setPage(1)
          }}
          className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value)
            setPage(1)
          }}
          className="cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All Status</option>
          {(['Available', 'Assigned', 'Lost', 'Maintenance'] as AssetStatus[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <span className="whitespace-nowrap text-xs text-gray-400">{filtered.length} result(s)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-gray-50">
              {['Asset ID', 'Asset Name', 'Category', 'Company', 'Location', 'Value (₹)', 'Warranty Expiry', 'Status', ''].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-gray-400">
                  No assets found.
                </td>
              </tr>
            ) : (
              paginated.map((asset) => (
                <tr key={asset.id} className="transition-colors hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-secondary">{asset.assetId}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">{asset.name}</p>
                    <p className="text-xs text-gray-400">{asset.vendorName}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{asset.categoryName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {asset.companyName.split(' ').slice(0, 2).join(' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{asset.locationName}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">₹{asset.value.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{asset.warrantyExpiry}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[asset.status]}`}>{asset.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit?.(asset)}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      >
                        <i className="ri-edit-line text-sm" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => addToast(`QR code for ${asset.assetId} downloaded`, 'info')}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      >
                        <i className="ri-qr-code-line text-sm" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              <i className="ri-arrow-left-s-line text-base" aria-hidden />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i + 1)}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                  page === i + 1 ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              <i className="ri-arrow-right-s-line text-base" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

