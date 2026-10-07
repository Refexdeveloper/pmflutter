import { useEffect, useRef, useState } from 'react'
import { createPmCaseDraft } from '../lib/kfPmMyItemsCreate.js'
import { pauseKissflowReads } from '../lib/kfRuntime.js'
import {
  assigneeApiFields,
  externalPersonText,
  personFromTypedValue,
  personPickerLabel,
  requesterFields,
  resolveKissflowDirectoryStatus,
  resolveKissflowUserField,
} from '../lib/kfUserField.js'
import { useProjectFunctions } from '../lib/kfProjectFormDropdowns.js'
import { PROJECTS_ENTITY } from '../lib/pmMyItemsEntities.js'
import { notifyProjectDetailsSaved } from '../lib/pmProjectDetails.js'
import { useUserMasterOptions } from '../lib/useUserMasterOptions.js'
import AssigneeStatusTags from './AssigneeStatusTags.jsx'
import CreateDetailsPopup from './CreateDetailsPopup.jsx'

const COMPANIES = ['Refex', 'Refex Group', 'Refex Industries Limited', 'Refex Renewables']
const PROJECT_TYPES = ['Tech', 'Non-tech']
const STATUSES = ['Open', 'Closed']
const PRIORITIES = ['High', 'Medium', 'Low']
const RISKS = ['High', 'Medium', 'Low']
const GOVERNANCE = ['Daily', 'Weekly', 'Bi-weekly', 'Monthly']

const inputClass =
  'h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#1E62F0]'
const selectClass = `${inputClass} appearance-none pr-8`

function Field({ label, required, hint, className = '', children }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-[13px] leading-none text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  )
}

function SelectWrap({ children }) {
  return (
    <div className="relative">
      {children}
      <i className="ri-arrow-down-s-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-lg text-slate-400" />
    </div>
  )
}

function YesNo({ value, onChange }) {
  return (
    <div className="flex h-10 overflow-hidden rounded border border-slate-300">
      {['Yes', 'No'].map((label) => {
        const on = (label === 'Yes') === value
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(label === 'Yes')}
            className={`flex-1 text-sm font-medium ${
              on ? 'bg-[#1E62F0] text-white' : 'bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function ProjectDetailsForm({ kf, defaults = {}, onClose }) {
  const user = kf?.user
  const [projectName, setProjectName] = useState(defaults.projectName || '')
  const [companyName, setCompanyName] = useState('')
  const [projectType, setProjectType] = useState('Tech')
  const [functions, setFunctions] = useState('')
  const [status, setStatus] = useState('Open')
  const [priority, setPriority] = useState('Medium')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [risk, setRisk] = useState('')
  const [riskMitigation, setRiskMitigation] = useState('')
  const [businessOwner, setBusinessOwner] = useState(() => personPickerLabel(user))
  const [sponsor, setSponsor] = useState('')
  const [projectOwner, setProjectOwner] = useState('')
  const [projectManager, setProjectManager] = useState('')
  const [cosOwner, setCosOwner] = useState('')
  const [tcoEfforts, setTcoEfforts] = useState('')
  const [governance, setGovernance] = useState('Monthly')
  const [vendorName, setVendorName] = useState('')
  const [techStack, setTechStack] = useState('')
  const [cbAnalysis, setCbAnalysis] = useState(false)
  const [aiUsage, setAiUsage] = useState(false)
  const [brd, setBrd] = useState(false)
  const [processDoc, setProcessDoc] = useState(false)
  const [supportDoc, setSupportDoc] = useState(false)
  const [reports, setReports] = useState(false)
  const [tally, setTally] = useState(false)
  const [sap, setSap] = useState(false)
  const [powerBi, setPowerBi] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)

  const { options: peopleOptions } = useUserMasterOptions(user)
  const functionOptions = useProjectFunctions(kf)

  useEffect(() => {
    pauseKissflowReads(120000)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [busy, onClose])

  const resolveTypedPerson = (value) => {
    const text = String(value || '').trim()
    if (!text) return { source: null, text: null }
    const selected = peopleOptions.find((o) => o.value === text || o.label === text)
    const source = personFromTypedValue(text, selected?.user)
    return {
      source,
      text: source ? externalPersonText(source) : { Name: text, Email: '', not_in_kissflow: true },
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current || busy) return
    if (!projectName.trim()) {
      setError('Project Name is required.')
      return
    }
    if (!functions) {
      setError('Functions is required.')
      return
    }
    if (!startDate || !endDate) {
      setError('Start Date and End Date are required.')
      return
    }
    if (!businessOwner.trim()) {
      setError('Business Owner is required.')
      return
    }
    if (!governance) {
      setError('Governance Frequency is required.')
      return
    }
    submittingRef.current = true
    setError('')
    setBusy(true)
    try {
      const tco = tcoEfforts === '' ? undefined : Number(tcoEfforts)
      const business = resolveTypedPerson(businessOwner)
      const sponsorPerson = resolveTypedPerson(sponsor)
      const owner = resolveTypedPerson(projectOwner)
      const manager = resolveTypedPerson(projectManager)
      const cos = resolveTypedPerson(cosOwner)
      const [businessStatus, sponsorKf, ownerKf, managerKf, cosKf] = await Promise.all([
        resolveKissflowDirectoryStatus(kf, business.source),
        resolveKissflowUserField(kf, sponsorPerson.source),
        resolveKissflowUserField(kf, owner.source),
        resolveKissflowUserField(kf, manager.source),
        resolveKissflowUserField(kf, cos.source),
      ])
      if (businessStatus.status === 'unverified') {
        setError('Couldn’t verify Kissflow for Business Owner. Try again.')
        return
      }
      const businessKf = businessStatus.user
      if (!businessKf) {
        setError('Business Owner must be a Kissflow user. This person is not in the Kissflow directory.')
        return
      }
      const body = {
        Name: projectName.trim(),
        Project_Name: projectName.trim(),
        Company_Name: companyName || undefined,
        Project_Type: projectType || undefined,
        Project_Category: functions || undefined,
        Functions: functions || undefined,
        Status_1: status || 'Open',
        Priority_1: priority || 'Medium',
        Start_Date: startDate,
        End_Date: endDate,
        Risk: risk || undefined,
        Risk_Mitigation_Details: riskMitigation || undefined,
        Business_Owner_Name: business.text?.Name || null,
        Business_Owner_Email: business.text?.Email || null,
        ...(sponsorPerson.text?.Name ? { Sponsor_Name: sponsorPerson.text.Name } : {}),
        ...(sponsorPerson.text?.Email ? { Sponsor_Email: sponsorPerson.text.Email } : {}),
        ...(owner.text?.Name ? { Project_Owner_Name: owner.text.Name } : {}),
        ...(owner.text?.Email ? { Project_Owner_Email: owner.text.Email } : {}),
        ...(manager.text?.Name ? { Project_Manager_Name: manager.text.Name } : {}),
        ...(manager.text?.Email ? { Project_Manager_Email: manager.text.Email } : {}),
        ...(cos.text?.Name ? { COS_Owner_Name: cos.text.Name } : {}),
        ...(cos.text?.Email ? { COS_Owner_Email: cos.text.Email } : {}),
        TCOEfforts: Number.isFinite(tco) ? tco : undefined,
        Governance_Frequency: governance,
        Vendor_Name: vendorName || undefined,
        Tech_Stack: techStack || undefined,
        Business_Owner: businessKf,
        AssignedTo: businessKf,
        Sponsor: sponsorKf || null,
        Project_Owner: ownerKf || null,
        Project_Manager: managerKf || null,
        COS_Owner: cosKf || null,
        CB_Analysis_Document_Available: cbAnalysis,
        AI_Usage: aiUsage,
        BRD_Available_1: brd,
        Process_Document_1: processDoc,
        Suuport_Available: supportDoc,
        Reports_Available: reports,
        Integrated_with_Tally: tally,
        Integrated_with_SAP: sap,
        Integrated_with_Power_BI: powerBi,
        ...assigneeApiFields('project', owner.source || manager.source),
        ...requesterFields(user),
      }
      const created = await createPmCaseDraft(kf, PROJECTS_ENTITY, body)
      kf?.client?.showInfo?.(
        created.webhookOnly
          ? 'Project sent to the Kissflow integration.'
          : created.instanceId
            ? `Project created (${created.instanceId}).`
            : 'Project created.',
      )
      notifyProjectDetailsSaved(created)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Could not create the project.')
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  const personInput = (listId, value, onChange, payloadField) => (
    <>
      <input
        className={inputClass}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Name or email"
        autoComplete="off"
      />
      <datalist id={listId}>
        {peopleOptions.map((o) => (
          <option key={`${listId}-${o.value}`} value={o.label} />
        ))}
      </datalist>
      <AssigneeStatusTags
        kf={kf}
        value={value}
        options={peopleOptions}
        loginUser={user}
        payloadField={payloadField}
      />
    </>
  )

  return (
    <CreateDetailsPopup title="Project Details" onClose={onClose} onSubmit={handleSubmit} busy={busy} error={error}>
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-4">
            <Field label="Project Name" required>
              <input className={inputClass} value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </Field>
            <Field label="Company Name">
              <SelectWrap>
                <select className={selectClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)}>
                  <option value="" />
                  {COMPANIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Project Type">
              <SelectWrap>
                <select className={selectClass} value={projectType} onChange={(e) => setProjectType(e.target.value)}>
                  <option value="" />
                  {PROJECT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Functions" required>
              <SelectWrap>
                <select className={selectClass} value={functions} onChange={(e) => setFunctions(e.target.value)}>
                  <option value="" />
                  {functionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrap>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-4">
            <Field label="Project Status">
              <SelectWrap>
                <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="" />
                  {STATUSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Priority">
              <SelectWrap>
                <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="" />
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrap>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-4">
            <Field label="Start Date" required>
              <div className="relative">
                <input type="date" className={`${inputClass} pr-9`} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <i className="ri-calendar-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
            <Field label="End Date" required>
              <div className="relative">
                <input type="date" className={`${inputClass} pr-9`} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <i className="ri-calendar-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
            <Field label="Risk">
              <SelectWrap>
                <select className={selectClass} value={risk} onChange={(e) => setRisk(e.target.value)}>
                  <option value="" />
                  {RISKS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrap>
            </Field>
            <Field label="Risk Mitigation Details">
              <input className={inputClass} value={riskMitigation} onChange={(e) => setRiskMitigation(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <Field label="Business Owner" required>
              {personInput('pm-project-business-owner', businessOwner, setBusinessOwner, 'Business_Owner')}
            </Field>
            <Field label="Sponsor">
              {personInput('pm-project-sponsor', sponsor, setSponsor, 'Sponsor')}
            </Field>
            <Field label="Project Owner">
              {personInput('pm-project-owner', projectOwner, setProjectOwner, 'Project_Owner')}
            </Field>
            <Field label="Project Manager">
              {personInput('pm-project-manager', projectManager, setProjectManager, 'Project_Manager')}
            </Field>
            <Field label="COS Owner">
              {personInput('pm-project-cos-owner', cosOwner, setCosOwner, 'COS_Owner')}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <Field label="TCO/Efforts" hint="Cost">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={tcoEfforts}
                onChange={(e) => setTcoEfforts(e.target.value)}
              />
            </Field>
            <Field label="Governance Frequency" required>
              <SelectWrap>
                <select className={selectClass} value={governance} onChange={(e) => setGovernance(e.target.value)}>
                  <option value="" />
                  {GOVERNANCE.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </SelectWrap>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-3">
            <Field label="Vendor Name" hint="From SCM">
              <input className={inputClass} value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
            </Field>
            <Field label="Tech Stack">
              <div className="relative">
                <input className={`${inputClass} pr-9`} value={techStack} onChange={(e) => setTechStack(e.target.value)} />
                <i className="ri-search-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </Field>
            <Field label="CB Analysis Document Available">
              <YesNo value={cbAnalysis} onChange={setCbAnalysis} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 md:grid-cols-4">
            <Field label="AI Usage"><YesNo value={aiUsage} onChange={setAiUsage} /></Field>
            <Field label="BRD Available"><YesNo value={brd} onChange={setBrd} /></Field>
            <Field label="Process Document Available"><YesNo value={processDoc} onChange={setProcessDoc} /></Field>
            <Field label="Support Document Available"><YesNo value={supportDoc} onChange={setSupportDoc} /></Field>
            <Field label="Reports Available"><YesNo value={reports} onChange={setReports} /></Field>
            <Field label="Integrated with Tally"><YesNo value={tally} onChange={setTally} /></Field>
            <Field label="Integrated with SAP"><YesNo value={sap} onChange={setSap} /></Field>
            <Field label="Integrated with Power BI"><YesNo value={powerBi} onChange={setPowerBi} /></Field>
          </div>
        </div>
    </CreateDetailsPopup>
  )
}
