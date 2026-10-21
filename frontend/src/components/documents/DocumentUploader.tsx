'use client';
import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Upload, FileText, Eye, Trash2, CheckCircle2, Clock,
  XCircle, ThumbsUp, ThumbsDown, Plus, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export type DocOwnerType = 'VEHICLE' | 'DRIVER' | 'USER' | 'ORGANIZATION' | 'CUSTOMER' | 'SUPPLIER';

interface Props {
  ownerType: DocOwnerType;
  ownerId:   string;
  canReview?: boolean;  // true for ADMIN / FLEET_MANAGER
  compact?:  boolean;   // smaller layout for sidebar panels
}

const CATEGORIES = [
  'REGISTRATION_CARD','INSURANCE','INSPECTION_CERTIFICATE','ROAD_TAX',
  'TRANSPORT_PERMIT','COMMERCIAL_LICENSE','TAXI_PERMIT','ROADWORTHINESS',
  'EMISSION_CERTIFICATE','PURCHASE_INVOICE','OWNERSHIP_CERTIFICATE',
  'DRIVING_LICENSE','NATIONAL_ID','PASSPORT','MEDICAL_CERTIFICATE',
  'POLICE_CLEARANCE','EMPLOYMENT_CONTRACT','PHOTO','YELLOW_CARD','OTHER',
];

const STATUS_ICON: Record<string, JSX.Element> = {
  VERIFIED:       <CheckCircle2 size={13} className="text-green-600" />,
  PENDING_REVIEW: <Clock        size={13} className="text-yellow-600" />,
  PENDING_UPLOAD: <Upload       size={13} className="text-gray-400" />,
  REJECTED:       <XCircle      size={13} className="text-red-600" />,
  EXPIRED:        <AlertTriangle size={13} className="text-red-600" />,
};

const STATUS_CLS: Record<string, string> = {
  VERIFIED:       'bg-green-100 text-green-800',
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-800',
  PENDING_UPLOAD: 'bg-gray-100 text-gray-600',
  REJECTED:       'bg-red-100 text-red-800',
  EXPIRED:        'bg-red-100 text-red-800',
};

export function DocumentUploader({ ownerType, ownerId, canReview = false, compact = false }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showAddModal, setShowAddModal]   = useState(false);
  const [uploading, setUploading]         = useState<string | null>(null); // docId being uploaded
  const [uploadPct, setUploadPct]         = useState(0);
  const [rejectingId, setRejectingId]     = useState<string | null>(null);
  const [rejectReason, setRejectReason]   = useState('');
  const [pendingUploadDocId, setPendingUploadDocId] = useState<string | null>(null);

  // Add form state
  const [form, setForm] = useState({
    label: '', category: 'OTHER', documentNumber: '', issuer: '',
    issuedAt: '', expiresAt: '', notes: '',
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['documents', ownerType, ownerId],
    queryFn:  () => documentApi.list({ ownerType, ownerId }),
  });

  // Create document slot
  const createMutation = useMutation({
    mutationFn: (file?: File) => file
      ? documentApi.uploadAndCreate({ ownerType, ownerId, ...form }, file, p => setUploadPct(p))
      : documentApi.create({ ownerType, ownerId, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] });
      qc.invalidateQueries({ queryKey: ['doc-compliance'] });
      toast.success('Document added');
      setShowAddModal(false);
      setForm({ label: '', category: 'OTHER', documentNumber: '', issuer: '', issuedAt: '', expiresAt: '', notes: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  // Upload file to existing slot
  async function handleFileUpload(docId: string, file: File) {
    setUploading(docId);
    setUploadPct(0);
    try {
      await documentApi.uploadFile(docId, file, p => setUploadPct(p));
      qc.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] });
      qc.invalidateQueries({ queryKey: ['doc-compliance'] });
      toast.success('File uploaded');
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Upload failed');
    } finally {
      setUploading(null);
      setUploadPct(0);
      setPendingUploadDocId(null);
    }
  }

  const verifyMutation = useMutation({
    mutationFn: (id: string) => documentApi.verify(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] }); toast.success('Verified'); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => documentApi.reject(id, reason),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] }); toast.success('Rejected'); setRejectingId(null); setRejectReason(''); },
    onError:    (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['documents', ownerType, ownerId] }); toast.success('Deleted'); },
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>
          Documents <span className="text-gray-400 font-normal">({docs.length})</span>
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <FileText size={24} className="text-gray-300 mx-auto mb-1" />
          <p className="text-sm text-gray-400">No documents yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <FileText size={15} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {STATUS_ICON[doc.status]}
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.label}</p>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_CLS[doc.status] ?? 'bg-gray-100 text-gray-700')}>
                    {doc.status.replace(/_/g, ' ')}
                  </span>
                  {doc.expiresAt && (
                    <span className="text-xs text-gray-400">{formatDate(doc.expiresAt)}</span>
                  )}
                </div>
                {doc.rejectionReason && (
                  <p className="text-xs text-red-500 mt-0.5 truncate">{doc.rejectionReason}</p>
                )}
                {uploading === doc.id && (
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadPct}%` }} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* View file */}
                {doc.fileUrl && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                    <Eye size={13} />
                  </a>
                )}
                {/* Upload file to pending slot */}
                {doc.status === 'PENDING_UPLOAD' && (
                  <button
                    onClick={() => { setPendingUploadDocId(doc.id); fileRef.current?.click(); }}
                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition">
                    <Upload size={13} />
                  </button>
                )}
                {/* Review actions */}
                {canReview && doc.status === 'PENDING_REVIEW' && (
                  <>
                    <button onClick={() => verifyMutation.mutate(doc.id)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition" title="Verify">
                      <ThumbsUp size={13} />
                    </button>
                    <button onClick={() => { setRejectingId(doc.id); setRejectReason(''); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Reject">
                      <ThumbsDown size={13} />
                    </button>
                  </>
                )}
                {/* Delete */}
                <button onClick={() => { if (confirm('Delete this document?')) deleteMutation.mutate(doc.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input for uploading to an existing slot */}
      <input
        ref={fileRef} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && pendingUploadDocId) handleFileUpload(pendingUploadDocId, file);
          e.target.value = '';
        }}
      />

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Document</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Motor Insurance 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document #</label>
                  <input value={form.documentNumber} onChange={e => setForm(f => ({ ...f, documentNumber: e.target.value }))}
                    placeholder="Policy / ID number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issuer</label>
                <input value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))}
                  placeholder="Issuing authority / company"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                  <input type="date" value={form.issuedAt} onChange={e => setForm(f => ({ ...f, issuedAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload File (optional)</label>
                <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 hover:border-brand-500 rounded-lg py-4 cursor-pointer transition">
                  <Upload size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">Click to select PDF or image</span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file && form.label) createMutation.mutate(file);
                      else if (file && !form.label) toast.error('Enter a label first');
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={() => createMutation.mutate(undefined)}
                disabled={!form.label || createMutation.isPending}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                {createMutation.isPending ? 'Saving…' : 'Save (no file)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-3">Rejection Reason</h2>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} placeholder="Why is this document rejected?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectingId(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => rejectMutation.mutate({ id: rejectingId, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60">
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
