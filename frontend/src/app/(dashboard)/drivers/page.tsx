'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Users, Plus, Car, Loader2, ChevronRight, X, UserCheck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

type Step = 'basic' | 'license' | 'employment' | 'health' | 'banking';
const STEPS: { id: Step; label: string }[] = [
  { id: 'basic',      label: 'Personal' },
  { id: 'license',    label: 'License' },
  { id: 'employment', label: 'Employment' },
  { id: 'health',     label: 'Health' },
  { id: 'banking',    label: 'Banking' },
];

const LICENSE_CLASSES = ['A','B','C','D','E','F','A1','B1','C1','D1'];
const GENDERS         = ['MALE','FEMALE','OTHER'];
const BLOOD_GROUPS    = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Inp({ val, set, type = 'text', placeholder }: { val: string; set: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
  );
}

function Sel({ val, set, opts }: { val: string; set: (v: string) => void; opts: string[] }) {
  return (
    <select value={val} onChange={e => set(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
      <option value="">— Select —</option>
      {opts.map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
    </select>
  );
}

// Full driver form state
function useDriverForm() {
  const init = (v: string) => useState(v);
  const [firstName, setFirstName]         = init('');
  const [lastName, setLastName]           = init('');
  const [middleName, setMiddleName]       = init('');
  const [gender, setGender]               = init('');
  const [dob, setDob]                     = init('');
  const [nationality, setNationality]     = init('Rwanda');
  const [nationalId, setNationalId]       = init('');
  const [passportNo, setPassportNo]       = init('');
  const [phone, setPhone]                 = init('');
  const [altPhone, setAltPhone]           = init('');
  const [email, setEmail]                 = init('');
  const [address, setAddress]             = init('');
  const [city, setCity]                   = init('');
  const [district, setDistrict]           = init('');
  const [emergencyContact, setEmergency]  = init('');
  const [emergencyPhone, setEmergencyPhone] = init('');
  const [licenseNumber, setLicenseNumber] = init('');
  const [licenseClass, setLicenseClass]   = init('');
  const [licenseExpiry, setLicenseExpiry] = init('');
  const [licenseIssue, setLicenseIssue]   = init('');
  const [licenseCountry, setLicenseCountry] = init('Rwanda');
  const [restrictions, setRestrictions]   = init('');
  const [yearsDriving, setYearsDriving]   = init('');
  const [taxiExp, setTaxiExp]             = useState(false);
  const [truckExp, setTruckExp]           = useState(false);
  const [motoExp, setMotoExp]             = useState(false);
  const [busExp, setBusExp]               = useState(false);
  const [skills, setSkills]               = init('');
  const [employeeNo, setEmployeeNo]       = init('');
  const [department, setDepartment]       = init('');
  const [position, setPosition]           = init('Driver');
  const [employmentDate, setEmploymentDate] = init('');
  const [baseSalary, setBaseSalary]       = init('');
  const [commissionRate, setCommissionRate] = init('');
  const [bloodGroup, setBloodGroup]       = init('');
  const [medicalExpiry, setMedicalExpiry] = init('');
  const [medicalNotes, setMedicalNotes]   = init('');
  const [bankName, setBankName]           = init('');
  const [bankAccount, setBankAccount]     = init('');
  const [mobileMoney, setMobileMoney]     = init('');
  const [taxId, setTaxId]                 = init('');
  const [password, setPassword]           = init('');

  const build = () => ({
    firstName, lastName, middleName, gender, dateOfBirth: dob, nationality,
    nationalId, passportNumber: passportNo, phone, altPhone, email, address,
    city, district, emergencyContact, emergencyPhone,
    licenseNumber, licenseClass, licenseExpiry, licenseIssueDate: licenseIssue,
    licenseCountry, licenseRestrictions: restrictions,
    yearsDriving: yearsDriving ? parseInt(yearsDriving) : undefined,
    taxiExperience: taxiExp, truckExperience: truckExp,
    motoExperience: motoExp, busExperience: busExp, specialSkills: skills,
    employeeNumber: employeeNo, department, position,
    employmentDate: employmentDate || undefined,
    baseSalary: baseSalary ? parseFloat(baseSalary) : undefined,
    commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
    bloodGroup, medicalExpiry, medicalNotes,
    bankName, bankAccount, mobileMoney, taxId, password,
  });

  return {
    fields: {
      firstName, setFirstName, lastName, setLastName, middleName, setMiddleName,
      gender, setGender, dob, setDob, nationality, setNationality,
      nationalId, setNationalId, passportNo, setPassportNo,
      phone, setPhone, altPhone, setAltPhone, email, setEmail,
      address, setAddress, city, setCity, district, setDistrict,
      emergencyContact, setEmergency, emergencyPhone, setEmergencyPhone,
      licenseNumber, setLicenseNumber, licenseClass, setLicenseClass,
      licenseExpiry, setLicenseExpiry, licenseIssue, setLicenseIssue,
      licenseCountry, setLicenseCountry, restrictions, setRestrictions,
      yearsDriving, setYearsDriving, taxiExp, setTaxiExp,
      truckExp, setTruckExp, motoExp, setMotoExp, busExp, setBusExp,
      skills, setSkills,
      employeeNo, setEmployeeNo, department, setDepartment,
      position, setPosition, employmentDate, setEmploymentDate,
      baseSalary, setBaseSalary, commissionRate, setCommissionRate,
      bloodGroup, setBloodGroup, medicalExpiry, setMedicalExpiry,
      medicalNotes, setMedicalNotes, bankName, setBankName,
      bankAccount, setBankAccount, mobileMoney, setMobileMoney,
      taxId, setTaxId, password, setPassword,
    },
    build,
  };
}

export default function DriversPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal]   = useState(false);
  const [assignModal, setAssignModal] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [step, setStep] = useState<Step>('basic');
  const { fields: f, build } = useDriverForm();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiClient.get('/drivers').then(r => r.data),
  });

  const { data: vehiclesResp } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => apiClient.get('/vehicles').then(r => r.data.data ?? []),
  });
  const vehicles = vehiclesResp ?? [];

  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/drivers', build()).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver created successfully');
      setShowModal(false); setStep('basic');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed to create driver'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ driverId, vehicleId }: { driverId: string; vehicleId: string | null }) =>
      apiClient.patch(`/drivers/${driverId}/assign`, { vehicleId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Assignment updated');
      setAssignModal(null);
    },
  });

  const stepIdx = STEPS.findIndex(s => s.id === step);
  const isLastStep  = stepIdx === STEPS.length - 1;
  const isFirstStep = stepIdx === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-500 text-sm">{drivers.length} registered drivers</p>
        </div>
        <button onClick={() => { setShowModal(true); setStep('basic'); }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={16} /> Add Driver
        </button>
      </div>

      {/* Driver cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? [...Array(6)].map((_, i) => <div key={i} className="h-44 bg-gray-200 rounded-xl animate-pulse" />)
          : drivers.length
            ? drivers.map((d: any) => (
                <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
                        {d.user.firstName[0]}{d.user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{d.user.firstName} {d.user.lastName}</p>
                        <p className="text-xs text-gray-500">{d.user.email}</p>
                        {d.nationalId && <p className="text-xs text-gray-400 font-mono">ID: {d.nationalId}</p>}
                      </div>
                    </div>
                    <Badge variant={d.user.isActive ? 'success' : 'gray'}>
                      {d.user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">License</span>
                      <span className="font-mono text-gray-800 text-xs">{d.licenseNumber}</span>
                    </div>
                    {d.licenseClass && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Class</span>
                        <span className="text-gray-800">Class {d.licenseClass}</span>
                      </div>
                    )}
                    {d.licenseExpiry && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Expires</span>
                        <span className={cn('text-xs', new Date(d.licenseExpiry) < new Date() ? 'text-red-600 font-bold' : 'text-gray-800')}>
                          {formatDate(d.licenseExpiry)}
                          {new Date(d.licenseExpiry) < new Date() && ' ⚠ EXPIRED'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Vehicle</span>
                      <span className={cn('font-medium text-xs', d.currentVehicle ? 'text-brand-600' : 'text-gray-400')}>
                        {d.currentVehicle ? `${d.currentVehicle.licensePlate}` : 'Unassigned'}
                      </span>
                    </div>
                    {d.user.phone && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Phone</span>
                        <span className="text-gray-800 text-xs">{d.user.phone}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => { setAssignModal(d); setSelectedVehicle(d.currentVehicle?.id ?? ''); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition text-gray-600">
                    <Car size={14} />
                    {d.currentVehicle ? 'Reassign Vehicle' : 'Assign Vehicle'}
                  </button>
                </div>
              ))
            : (
              <div className="col-span-3">
                <EmptyState icon={Users} title="No drivers yet" description="Add drivers to assign them to vehicles."
                  action={{ label: 'Add Driver', onClick: () => setShowModal(true) }} />
              </div>
            )
        }
      </div>

      {/* ── Add Driver Modal ──────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <UserCheck size={20} className="text-brand-600" />
                <h2 className="text-lg font-semibold">Register New Driver</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>

            {/* Step tabs */}
            <div className="flex border-b shrink-0 overflow-x-auto">
              {STEPS.map((s, i) => (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className={cn(
                    'flex items-center gap-1 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition',
                    step === s.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}>
                  <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-xs mr-1', i <= stepIdx ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500')}>
                    {i + 1}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Form content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {step === 'basic' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name *"><Inp val={f.firstName} set={f.setFirstName} placeholder="Jean" /></Field>
                  <Field label="Last Name *"><Inp val={f.lastName} set={f.setLastName} placeholder="Baptiste" /></Field>
                  <Field label="Middle Name"><Inp val={f.middleName} set={f.setMiddleName} /></Field>
                  <Field label="Gender"><Sel val={f.gender} set={f.setGender} opts={GENDERS} /></Field>
                  <Field label="Date of Birth"><Inp val={f.dob} set={f.setDob} type="date" /></Field>
                  <Field label="Nationality"><Inp val={f.nationality} set={f.setNationality} placeholder="Rwanda" /></Field>
                  <Field label="National ID *"><Inp val={f.nationalId} set={f.setNationalId} placeholder="1 XXXX X XXXXXXX X XX" /></Field>
                  <Field label="Passport Number"><Inp val={f.passportNo} set={f.setPassportNo} /></Field>
                  <Field label="Phone *"><Inp val={f.phone} set={f.setPhone} placeholder="+250 788 000 000" /></Field>
                  <Field label="Alternative Phone"><Inp val={f.altPhone} set={f.setAltPhone} /></Field>
                  <Field label="Email *"><Inp val={f.email} set={f.setEmail} type="email" placeholder="driver@example.com" /></Field>
                  <Field label="Password (initial)"><Inp val={f.password} set={f.setPassword} type="password" /></Field>
                  <Field label="Address"><Inp val={f.address} set={f.setAddress} placeholder="KG 123 St, Kigali" /></Field>
                  <Field label="City"><Inp val={f.city} set={f.setCity} placeholder="Kigali" /></Field>
                  <Field label="District"><Inp val={f.district} set={f.setDistrict} placeholder="Gasabo" /></Field>
                  <Field label="Emergency Contact"><Inp val={f.emergencyContact} set={f.setEmergency} placeholder="Name" /></Field>
                  <Field label="Emergency Phone"><Inp val={f.emergencyPhone} set={f.setEmergencyPhone} placeholder="+250 7XX XXX XXX" /></Field>
                </div>
              )}

              {step === 'license' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="License Number *"><Inp val={f.licenseNumber} set={f.setLicenseNumber} placeholder="RWXXX12345" /></Field>
                  <Field label="License Class"><Sel val={f.licenseClass} set={f.setLicenseClass} opts={LICENSE_CLASSES} /></Field>
                  <Field label="Issue Date"><Inp val={f.licenseIssue} set={f.setLicenseIssue} type="date" /></Field>
                  <Field label="Expiry Date"><Inp val={f.licenseExpiry} set={f.setLicenseExpiry} type="date" /></Field>
                  <Field label="Issuing Country"><Inp val={f.licenseCountry} set={f.setLicenseCountry} placeholder="Rwanda" /></Field>
                  <Field label="Restrictions"><Inp val={f.restrictions} set={f.setRestrictions} placeholder="None" /></Field>
                  <Field label="Years Driving Experience"><Inp val={f.yearsDriving} set={f.setYearsDriving} type="number" placeholder="5" /></Field>
                  <Field label="Special Skills"><Inp val={f.skills} set={f.setSkills} placeholder="Heavy vehicles, Night driving…" /></Field>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-2">Vehicle Experience</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { label: 'Taxi/Moto',    val: f.taxiExp,  set: f.setTaxiExp },
                        { label: 'Truck/Heavy',  val: f.truckExp, set: f.setTruckExp },
                        { label: 'Motorcycle',   val: f.motoExp,  set: f.setMotoExp },
                        { label: 'Bus/Coach',    val: f.busExp,   set: f.setBusExp },
                      ].map(({ label, val, set }) => (
                        <label key={label} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                            className="w-4 h-4 text-brand-600 rounded" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 'employment' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Employee Number"><Inp val={f.employeeNo} set={f.setEmployeeNo} placeholder="EMP-001" /></Field>
                  <Field label="Department"><Inp val={f.department} set={f.setDepartment} placeholder="Operations" /></Field>
                  <Field label="Position"><Inp val={f.position} set={f.setPosition} placeholder="Driver" /></Field>
                  <Field label="Employment Date"><Inp val={f.employmentDate} set={f.setEmploymentDate} type="date" /></Field>
                  <Field label="Base Salary (RWF/month)"><Inp val={f.baseSalary} set={f.setBaseSalary} type="number" placeholder="150000" /></Field>
                  <Field label="Commission Rate (%)"><Inp val={f.commissionRate} set={f.setCommissionRate} type="number" placeholder="5" /></Field>
                </div>
              )}

              {step === 'health' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Blood Group"><Sel val={f.bloodGroup} set={f.setBloodGroup} opts={BLOOD_GROUPS} /></Field>
                  <Field label="Medical Certificate Expiry"><Inp val={f.medicalExpiry} set={f.setMedicalExpiry} type="date" /></Field>
                  <div className="col-span-2">
                    <Field label="Medical Notes">
                      <textarea value={f.medicalNotes} onChange={e => f.setMedicalNotes(e.target.value)} rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        placeholder="Any medical conditions, allergies, or restrictions…" />
                    </Field>
                  </div>
                </div>
              )}

              {step === 'banking' && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bank Name"><Inp val={f.bankName} set={f.setBankName} placeholder="Bank of Kigali, Equity…" /></Field>
                  <Field label="Bank Account Number"><Inp val={f.bankAccount} set={f.setBankAccount} /></Field>
                  <Field label="Mobile Money (MTN/Airtel)"><Inp val={f.mobileMoney} set={f.setMobileMoney} placeholder="+250 7XX XXX XXX" /></Field>
                  <Field label="TIN Number"><Inp val={f.taxId} set={f.setTaxId} /></Field>
                  <div className="col-span-2">
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <p>After creating the driver, upload documents (license, ID, medical certificate) from the driver profile page.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0 rounded-b-2xl">
              <button onClick={() => !isFirstStep && setStep(STEPS[stepIdx - 1].id)}
                disabled={isFirstStep}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40">
                ← Back
              </button>
              <div className="flex items-center gap-1.5">
                {STEPS.map((s, i) => (
                  <span key={s.id} className={cn('h-2 rounded-full transition-all',
                    i === stepIdx ? 'w-6 bg-brand-600' : i < stepIdx ? 'w-2 bg-brand-300' : 'w-2 bg-gray-300'
                  )} />
                ))}
              </div>
              {isLastStep ? (
                <button onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !f.firstName || !f.lastName || !f.licenseNumber || !f.phone}
                  className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                  {createMutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Create Driver'}
                </button>
              ) : (
                <button onClick={() => setStep(STEPS[stepIdx + 1].id)}
                  disabled={!f.firstName || !f.lastName}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60">
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Vehicle Modal ──────────────────────────────────────── */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              Assign Vehicle — {assignModal.user.firstName} {assignModal.user.lastName}
            </h2>
            <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
              <option value="">No Vehicle (Unassign)</option>
              {vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.licensePlate} — {v.name} ({v.status})
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setAssignModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={() => assignMutation.mutate({ driverId: assignModal.id, vehicleId: selectedVehicle || null })}
                disabled={assignMutation.isPending}
                className="flex-1 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition disabled:opacity-60">
                {assignMutation.isPending ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
