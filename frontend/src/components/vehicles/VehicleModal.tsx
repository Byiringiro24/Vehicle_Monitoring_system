'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleApi, fleetApi } from '@/lib/api';
import { X, Loader2, Truck, Fuel, Settings, Shield, FileText, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const schema = z.object({
  // Basic
  name:             z.string().min(1, 'Name required'),
  licensePlate:     z.string().min(1, 'Plate required'),
  manufacturer:     z.string().min(1, 'Manufacturer required'),
  model:            z.string().min(1, 'Model required'),
  year:             z.coerce.number().min(1990).max(2030),
  vehicleClass:     z.string().default('SEDAN'),
  vehicleType:      z.string().default('CAR'),
  purpose:          z.string().default('COMPANY'),
  color:            z.string().optional(),
  vin:              z.string().optional(),
  engineNumber:     z.string().optional(),
  registrationNumber: z.string().optional(),
  fleetNumber:      z.string().optional(),
  assetTag:         z.string().optional(),
  fleetId:          z.string().optional(),
  // Energy
  energyType:       z.string().default('PETROL'),
  fuelCapacity:     z.coerce.number().optional(),
  recommendedFuel:  z.string().optional(),
  avgConsumption:   z.coerce.number().optional(),
  minFuelAlert:     z.coerce.number().optional(),
  batteryCapacityKwh: z.coerce.number().optional(),
  // Engine
  engineType:       z.string().optional(),
  engineCc:         z.coerce.number().optional(),
  horsepower:       z.coerce.number().optional(),
  transmission:     z.string().default('MANUAL'),
  driveType:        z.string().optional(),
  // Ownership
  ownershipType:    z.string().default('COMPANY_OWNED'),
  purchaseDate:     z.string().optional(),
  purchasePrice:    z.coerce.number().optional(),
  currentValue:     z.coerce.number().optional(),
  ownerName:        z.string().optional(),
  // Insurance
  insuranceCompany: z.string().optional(),
  insurancePolicyNo:z.string().optional(),
  insuranceExpiry:  z.string().optional(),
  insurancePremium: z.coerce.number().optional(),
  insuranceCoverage:z.string().optional(),
  // Compliance
  roadTaxExpiry:    z.string().optional(),
  inspectionExpiry: z.string().optional(),
  transportPermit:  z.string().optional(),
  transportPermitExpiry: z.string().optional(),
  // Maintenance
  oilChangeKmInterval: z.coerce.number().optional(),
  nextServiceDate:  z.string().optional(),
  // Tyres
  tyreBrand:        z.string().optional(),
  tyreSize:         z.string().optional(),
});
type VehicleForm = z.infer<typeof schema>;

type Step = 'basic' | 'energy' | 'engine' | 'ownership' | 'compliance';

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'basic',      label: 'Basic Info',    icon: <Truck size={14} /> },
  { id: 'energy',     label: 'Fuel/Energy',   icon: <Fuel size={14} /> },
  { id: 'engine',     label: 'Engine',        icon: <Settings size={14} /> },
  { id: 'ownership',  label: 'Ownership',     icon: <FileText size={14} /> },
  { id: 'compliance', label: 'Compliance',    icon: <Shield size={14} /> },
];

const VEHICLE_CLASSES = ['SEDAN','SUV','PICKUP','VAN','TRUCK','BUS','MINIBUS','MOTORCYCLE','BICYCLE','TRAILER','TRACTOR','FORKLIFT','HEAVY_EQUIPMENT','OTHER'];
const PURPOSES        = ['TAXI','DELIVERY','COMPANY','CONSTRUCTION','AGRICULTURE','LOGISTICS','AMBULANCE','GOVERNMENT','RENTAL','PERSONAL','OTHER'];
const ENERGY_TYPES    = ['PETROL','DIESEL','ELECTRIC','HYBRID','PHEV','HYDROGEN','LPG','CNG'];
const OWNERSHIP_TYPES = ['COMPANY_OWNED','LEASED','CUSTOMER_OWNED','FINANCED'];
const TRANSMISSIONS   = ['MANUAL','AUTOMATIC','CVT','SEMI_AUTO'];
const DRIVE_TYPES     = ['FWD','RWD','AWD','4WD'];

function Field({ label, error, children, span2 = false }: { label: string; error?: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={cn(span2 && 'col-span-2')}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Input({ reg, type = 'text', placeholder }: { reg: any; type?: string; placeholder?: string }) {
  return (
    <input {...reg} type={type} placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
  );
}

function Select({ reg, opts }: { reg: any; opts: string[] | { value: string; label: string }[] }) {
  return (
    <select {...reg} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
      <option value="">— Select —</option>
      {opts.map((o) => typeof o === 'string'
        ? <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  );
}

export function VehicleModal({ vehicle, onClose }: { vehicle?: any; onClose: () => void }) {
  const qc   = useQueryClient();
  const isEdit = !!vehicle;
  const [step, setStep] = useState<Step>('basic');

  const { data: fleets } = useQuery({ queryKey: ['fleets'], queryFn: fleetApi.list });

  const defaults = vehicle ? {
    ...vehicle,
    fleetId:      vehicle.fleet?.id ?? '',
    purchaseDate: vehicle.purchaseDate?.slice(0, 10) ?? '',
    insuranceExpiry: vehicle.insuranceExpiry?.slice(0, 10) ?? '',
    roadTaxExpiry:   vehicle.roadTaxExpiry?.slice(0, 10) ?? '',
    inspectionExpiry: vehicle.inspectionExpiry?.slice(0, 10) ?? '',
    nextServiceDate:  vehicle.nextServiceDate?.slice(0, 10) ?? '',
    transportPermitExpiry: vehicle.transportPermitExpiry?.slice(0, 10) ?? '',
  } : {
    year: new Date().getFullYear(), vehicleClass: 'SEDAN', vehicleType: 'CAR',
    purpose: 'COMPANY', energyType: 'PETROL', ownershipType: 'COMPANY_OWNED',
    transmission: 'MANUAL',
  };

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<VehicleForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const energyType = watch('energyType');
  const isElectric = energyType === 'ELECTRIC';
  const isHybrid   = energyType === 'HYBRID' || energyType === 'PHEV';

  const mutation = useMutation({
    mutationFn: (data: VehicleForm) => isEdit ? vehicleApi.update(vehicle.id, data) : vehicleApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(isEdit ? 'Vehicle updated' : 'Vehicle created');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed'),
  });

  const currentStepIdx = STEPS.findIndex(s => s.id === step);
  const isLast  = currentStepIdx === STEPS.length - 1;
  const isFirst = currentStepIdx === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition"><X size={18} /></button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b shrink-0 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => setStep(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition',
                step === s.id
                  ? 'border-brand-600 text-brand-700 bg-brand-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {s.icon} {s.label}
              {i < STEPS.length - 1 && <ChevronRight size={12} className="ml-1 text-gray-300" />}
            </button>
          ))}
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── BASIC INFO ───────────────────────────────────────────── */}
            {step === 'basic' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Vehicle Name *" error={errors.name?.message}>
                  <Input reg={register('name')} placeholder="e.g. Truck Alpha" />
                </Field>
                <Field label="License Plate * (e.g. RAB 001 A)" error={errors.licensePlate?.message}>
                  <Input reg={register('licensePlate')} placeholder="RAB 001 A" />
                </Field>
                <Field label="Manufacturer *" error={errors.manufacturer?.message}>
                  <Input reg={register('manufacturer')} placeholder="Toyota, Isuzu, BYD…" />
                </Field>
                <Field label="Model *" error={errors.model?.message}>
                  <Input reg={register('model')} placeholder="Hilux, NQR, Atto 3…" />
                </Field>
                <Field label="Year *" error={errors.year?.message}>
                  <Input reg={register('year')} type="number" placeholder="2024" />
                </Field>
                <Field label="Color">
                  <Input reg={register('color')} placeholder="White, Blue…" />
                </Field>
                <Field label="Vehicle Class">
                  <Select reg={register('vehicleClass')} opts={VEHICLE_CLASSES} />
                </Field>
                <Field label="Purpose">
                  <Select reg={register('purpose')} opts={PURPOSES} />
                </Field>
                <Field label="VIN / Chassis Number">
                  <Input reg={register('vin')} placeholder="JTMHE3FJ…" />
                </Field>
                <Field label="Engine Number">
                  <Input reg={register('engineNumber')} placeholder="Optional" />
                </Field>
                <Field label="Registration Number">
                  <Input reg={register('registrationNumber')} />
                </Field>
                <Field label="Fleet Number / Asset Tag">
                  <Input reg={register('fleetNumber')} placeholder="FL-001" />
                </Field>
                <Field label="Fleet" span2>
                  <select {...register('fleetId')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    <option value="">No Fleet</option>
                    {(fleets ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </Field>
              </div>
            )}

            {/* ── FUEL / ENERGY ────────────────────────────────────────── */}
            {step === 'energy' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Energy Type" span2>
                  <Select reg={register('energyType')} opts={ENERGY_TYPES} />
                </Field>
                {/* Petrol/Diesel fields */}
                {!isElectric && (
                  <>
                    <Field label="Fuel Tank Capacity (L)">
                      <Input reg={register('fuelCapacity')} type="number" placeholder="60" />
                    </Field>
                    <Field label="Recommended Fuel">
                      <Input reg={register('recommendedFuel')} placeholder="e.g. Unleaded 95" />
                    </Field>
                    <Field label="Avg Consumption (L/100km)">
                      <Input reg={register('avgConsumption')} type="number" placeholder="8" />
                    </Field>
                    <Field label="Low Fuel Alert (%)">
                      <Input reg={register('minFuelAlert')} type="number" placeholder="15" />
                    </Field>
                  </>
                )}
                {/* Electric fields */}
                {(isElectric || isHybrid) && (
                  <>
                    <Field label="Battery Capacity (kWh)">
                      <Input reg={register('batteryCapacityKwh')} type="number" placeholder="60" />
                    </Field>
                  </>
                )}
              </div>
            )}

            {/* ── ENGINE ───────────────────────────────────────────────── */}
            {step === 'engine' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Engine Type">
                  <Input reg={register('engineType')} placeholder="Petrol / Diesel / Electric Motor" />
                </Field>
                <Field label="Engine Capacity (cc)">
                  <Input reg={register('engineCc')} type="number" placeholder="2000" />
                </Field>
                <Field label="Horsepower (HP)">
                  <Input reg={register('horsepower')} type="number" placeholder="150" />
                </Field>
                <Field label="Transmission">
                  <Select reg={register('transmission')} opts={TRANSMISSIONS} />
                </Field>
                <Field label="Drive Type">
                  <Select reg={register('driveType')} opts={DRIVE_TYPES} />
                </Field>
              </div>
            )}

            {/* ── OWNERSHIP ────────────────────────────────────────────── */}
            {step === 'ownership' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ownership Type">
                  <Select reg={register('ownershipType')} opts={OWNERSHIP_TYPES} />
                </Field>
                <Field label="Owner Name / Company">
                  <Input reg={register('ownerName')} placeholder="Your company name" />
                </Field>
                <Field label="Purchase Date">
                  <Input reg={register('purchaseDate')} type="date" />
                </Field>
                <Field label="Purchase Price (RWF)">
                  <Input reg={register('purchasePrice')} type="number" placeholder="15000000" />
                </Field>
                <Field label="Current Value (RWF)">
                  <Input reg={register('currentValue')} type="number" placeholder="12000000" />
                </Field>
                <Field label="Insurance Company">
                  <Input reg={register('insuranceCompany')} placeholder="Sanlam, Prime, UAP…" />
                </Field>
                <Field label="Insurance Policy No.">
                  <Input reg={register('insurancePolicyNo')} />
                </Field>
                <Field label="Insurance Expiry">
                  <Input reg={register('insuranceExpiry')} type="date" />
                </Field>
                <Field label="Premium (RWF/year)">
                  <Input reg={register('insurancePremium')} type="number" />
                </Field>
                <Field label="Coverage Type">
                  <Input reg={register('insuranceCoverage')} placeholder="Comprehensive / Third Party" />
                </Field>
              </div>
            )}

            {/* ── COMPLIANCE ───────────────────────────────────────────── */}
            {step === 'compliance' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Road Tax Expiry">
                  <Input reg={register('roadTaxExpiry')} type="date" />
                </Field>
                <Field label="Inspection Expiry">
                  <Input reg={register('inspectionExpiry')} type="date" />
                </Field>
                <Field label="Transport Permit No.">
                  <Input reg={register('transportPermit')} />
                </Field>
                <Field label="Transport Permit Expiry">
                  <Input reg={register('transportPermitExpiry')} type="date" />
                </Field>
                <Field label="Oil Change Interval (km)">
                  <Input reg={register('oilChangeKmInterval')} type="number" placeholder="5000" />
                </Field>
                <Field label="Next Service Date">
                  <Input reg={register('nextServiceDate')} type="date" />
                </Field>
                <Field label="Tyre Brand">
                  <Input reg={register('tyreBrand')} placeholder="Michelin, Bridgestone…" />
                </Field>
                <Field label="Tyre Size">
                  <Input reg={register('tyreSize')} placeholder="205/65 R16" />
                </Field>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0 rounded-b-2xl">
            <button type="button" onClick={() => !isFirst && setStep(STEPS[currentStepIdx - 1].id)}
              disabled={isFirst}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40">
              ← Back
            </button>
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <span key={s.id} className={cn('w-2 h-2 rounded-full transition',
                  i === currentStepIdx ? 'bg-brand-600 w-4' : i < currentStepIdx ? 'bg-brand-300' : 'bg-gray-300'
                )} />
              ))}
            </div>
            {isLast ? (
              <button type="submit" disabled={isSubmitting}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : isEdit ? 'Update Vehicle' : 'Create Vehicle'}
              </button>
            ) : (
              <button type="button" onClick={() => setStep(STEPS[currentStepIdx + 1].id)}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition">
                Next →
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
