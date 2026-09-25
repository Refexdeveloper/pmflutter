import { useRef, useState } from 'react'
import { useAppContext } from '@eam/context/AppContext'
import { companies, locations, categories } from '@eam/mocks/companies'

interface PreviewRow {
  name: string
  category: string
  company: string
  location: string
  value: string
  warranty: string
  generatedId: string
}

export const BulkUpload = ({ onClose }: { onClose: () => void }) => {
  const { addToast } = useAppContext()
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const parseCSV = (text: string): PreviewRow[] => {
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return []
    return lines
      .slice(1)
      .map((line, idx) => {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        const comp = companies.find((c) => c.code === (cols[2]?.toUpperCase() || '')) || companies[0]
        const loc = locations.find((l) => l.code === (cols[3]?.toUpperCase() || '')) || locations[0]
        const cat = categories.find((c) => c.name.toLowerCase() === (cols[1]?.toLowerCase() || '')) || categories[0]
        const seq = String(idx + 1).padStart(4, '0')
        return {
          name: cols[0] || `Asset ${idx + 1}`,
          category: cat.name,
          company: comp.name,
          location: loc.name,
          value: cols[4] || '0',
          warranty: cols[5] || '2027-01-01',
          generatedId: `${comp.code}-${loc.code}-${cat.code}-${seq}`,
        }
      })
      .slice(0, 20)
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        addToast('Could not parse file. Ensure format is correct.', 'error')
        return
      }
      setPreview(rows)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleConfirm = () => {
    addToast(`${preview.length} assets imported successfully`, 'success')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-3xl overflow-hidden rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4" style={{ background: '#023957' }}>
          <h2 className="text-sm font-semibold text-white">Bulk Upload Assets</h2>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20">
            <i className="ri-close-line text-base" aria-hidden />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' ? (
            <div>
              <div className="mb-4 rounded-lg bg-blue-50 p-4 text-xs text-secondary">
                <p className="mb-1 font-semibold">Expected CSV Format:</p>
                <code className="font-mono">Name, Category, Company Code, Location Code, Value, Warranty Expiry</code>
                <p className="mt-1 text-gray-500">Example: Dell Latitude, Laptop, MIPL, CHN, 75000, 2027-06-30</p>
              </div>
              <div
                className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 p-10 text-center transition-colors hover:border-secondary"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                role="presentation"
              >
                <i className="ri-upload-cloud-2-line text-4xl text-gray-300" aria-hidden />
                <p className="mt-2 text-sm font-medium text-gray-600">Drop CSV / Excel file here</p>
                <p className="mt-1 text-xs text-gray-400">or click to browse</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-gray-600">{preview.length} records parsed. Review before importing:</p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Generated ID', 'Name', 'Category', 'Company', 'Location', 'Value', 'Warranty'].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-gray-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-mono text-xs font-medium text-secondary">{row.generatedId}</td>
                        <td className="px-3 py-2 text-xs text-gray-800">{row.name}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{row.category}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{row.company}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{row.location}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">₹{parseInt(row.value, 10).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{row.warranty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="cursor-pointer whitespace-nowrap rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="cursor-pointer whitespace-nowrap rounded-lg px-5 py-2 text-sm font-medium text-white hover:opacity-90"
                  style={{ background: '#023957' }}
                >
                  Import {preview.length} Assets
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

