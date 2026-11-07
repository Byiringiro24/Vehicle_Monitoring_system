'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motoApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useParams, useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, Save, Truck, FileText, Check } from 'lucide-react';
import Link from 'next/link';

export default function MotoContractPage() {
  const params = useParams();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const driverId = params.id as string;

  const { data: driver, isLoading } = useQuery({
    queryKey: ['moto-driver-contract', driverId],
    queryFn: () => motoApi.getDriver(driverId),
  });

  const signContract = useMutation({
    mutationFn: () => motoApi.updateDriver(driverId, {
      contractSignedAt: new Date().toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moto-driver-contract'] });
      toast.success('Contract signed and recorded');
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  if (isLoading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;
  if (!driver) return <div className="text-center py-10">Driver not found</div>;

  const d: any = driver;
  const orgName = user?.organization?.name ?? 'ValQuor Ltd';
  const today = new Date();

  return (
    <div className="max-w-3xl space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between no-print">
        <Link href={`/moto/${driverId}`} className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to driver
        </Link>
        <div className="flex gap-2">
          {d.contractSignedAt ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <Check size={14} /> Signed on {formatDate(d.contractSignedAt)}
            </span>
          ) : (
            <button onClick={() => signContract.mutate()} disabled={signContract.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition shadow-sm disabled:opacity-60">
              <Save size={14} /> {signContract.isPending ? 'Signing…' : 'Mark as signed'}
            </button>
          )}
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition shadow-sm">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Contract document */}
      <div id="contract-print" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 print:border-0 print:shadow-none">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
              <Truck size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-gray-900">{orgName}</h1>
          </div>
          <h2 className="text-lg font-bold text-gray-900">AMASEZERANO YO GUKORESHA MOTO Y'AMASHANYARAZI</h2>
          <p className="text-sm text-gray-600">CONTRACT FOR THE USE OF ELECTRIC MOTORCYCLE</p>
        </div>

        {/* Parties */}
        <div className="space-y-3 text-sm mb-6">
          <p><strong>Hano hashyizweho:</strong> {orgName} (havugweho n'umunyamabanga nshingwabikorwa: <span className="underline">{user?.firstName} {user?.lastName}</span>)</p>
          <p><strong>N'umukoresha moto:</strong> <span className="font-bold underline">{d.firstName} {d.lastName}</span></p>
          <p><strong>Indangamuntu:</strong> <span className="underline">{d.nationalId ?? '________________'}</span></p>
          <p><strong>Leta y'amafaranga:</strong> <span className="underline">{d.licenseNumber ?? '________________'}</span> · <strong>Ubwoko:</strong> {d.licenseClass ?? 'B'}</p>
          <p><strong>Telefoni:</strong> <span className="underline">{d.phone ?? '________________'}</span></p>
          <p><strong>Aho atuye:</strong> <span className="underline">{d.address ?? '________________'}</span></p>
        </div>

        {/* Articles */}
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <p className="font-bold">Ingingo ya 1: INTEGO Y'AMASEZERANO</p>
            <p className="mt-1">Uruasezerano rugamije gukoresha moto y'amashanyarazi mu gutwara abagenzi gusa (moto-taxi). Nta kindi cyo gukoresha moto bisabwa.</p>
          </div>

          <div>
            <p className="font-bold">Ingingo ya 2: UBYISHYUWE BURI KUMUNSI</p>
            <p className="mt-1">Umukoresha abyishyura <span className="font-bold">RWF {d.dailyRate?.toLocaleString()}</span> ku munsi, cyangwa <span className="font-bold">RWF {d.weeklyRate?.toLocaleString()}</span> mu cyumweru (iminsi 6).</p>
            <p className="mt-1">Amabwiriza: amafaranga agomba kumenyekerewa saa <strong>{d.paymentDeadline ?? '21:00'}</strong> z'umugoroba ku munsi w'ibyishyuwe.</p>
            <p className="mt-1">Igihe atabyishyuye, amafaranga y'uyu munsi abengururwa ku munsi ukurikira nk'igisebe (dettes).</p>
          </div>

          <div>
            <p className="font-bold">Ingingo ya 3: INSHINGANO ZO KUBUNGA</p>
            <p className="mt-1">Umukoresha ni we ushinzwe gusukura no kubungaburumoto, kugenzura umuriro, amapne, n'ibindi byo kwitabaho ku buri munsi.</p>
          </div>

          <div>
            <p className="font-bold">Ingingo ya 4: Gukoresha Moto</p>
            <p className="mt-1">Moto igomba gukoreshwa mu gihugu cy'u Rwanda gusa. Nta kindi cyo gukoresha moto hakurya y'amasezerano. Nta na kimwe cyo kuyiguza cyangwa gukoresha abandi bantu.</p>
          </div>

          <div>
            <p className="font-bold">Ingingo ya 5: IGIHE CY'AMASEZERANO</p>
            <p className="mt-1">Uruasezerano rwa tangira ku itariki <span className="underline">{formatDate(today)}</span>. Rwa rero, umukoresha ashobora gusoza kwerekana iminsi 7 mbere y'isanga.</p>
            <p className="mt-1">Nyir'uMoto ashobora kurangiza urwasezerano igihe cyose, umugobeko w'agaciro.</p>
          </div>

          <div>
            <p className="font-bold">Ingingo ya 6: KONGERA MOTO</p>
            <p className="mt-1">Igihe cyo kongera moto, nyiruMoto ashobora gusaba gusubiza moto, n'ibyangombwa byose bifatanye n'amasezerano.</p>
          </div>
        </div>

        {/* Referrals / Witnesses */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="font-bold text-sm text-gray-900 mb-3">Abahamya (Referrals)</p>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p>1. <span className="underline">{d.referral1Name ?? '________________'}</span></p>
              <p className="text-xs text-gray-500">Telefoni: <span className="underline">{d.referral1Phone ?? '________________'}</span></p>
            </div>
            <div>
              <p>2. <span className="underline">{d.referral2Name ?? '________________'}</span></p>
              <p className="text-xs text-gray-500">Telefoni: <span className="underline">{d.referral2Phone ?? '________________'}</span></p>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-3 gap-8 text-center text-sm">
          <div>
            <p className="font-medium text-gray-900">Nyir'uMoto</p>
            <p className="text-xs text-gray-500">{orgName}</p>
            <div className="mt-12 border-t border-gray-400 pt-1">
              <p className="text-xs text-gray-400">Umukono & Itariki</p>
            </div>
          </div>
          <div>
            <p className="font-medium text-gray-900">Umukoresha</p>
            <p className="text-xs text-gray-500">{d.firstName} {d.lastName}</p>
            <div className="mt-12 border-t border-gray-400 pt-1">
              <p className="text-xs text-gray-400">Umukono & Itariki</p>
            </div>
          </div>
          <div>
            <p className="font-medium text-gray-900">Umuhamya</p>
            <p className="text-xs text-gray-500">Witness</p>
            <div className="mt-12 border-t border-gray-400 pt-1">
              <p className="text-xs text-gray-400">Umukono & Itariki</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            Generated by ARTIC VMS · {formatDate(today)} · {orgName}<br />
            This contract is auto-generated from driver records and can be edited by the Company Admin.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #contract-print, #contract-print * { visibility: visible; }
          #contract-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
