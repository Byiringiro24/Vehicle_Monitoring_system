'use client';
import { ShieldOff, ArrowLeft, Mail } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface Props {
  permissionLabel?: string;
  requiredRole?: string;
}

/**
 * Message B — The organization has the feature, but this user's role
 * doesn't include the permission. Contact Company Admin.
 */
export function PermissionDenied({ permissionLabel, requiredRole }: Props) {
  const { user } = useAuthStore();
  const orgName  = user?.organization?.name ?? 'your organization';

  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-amber-50 text-amber-500 mb-6">
          <ShieldOff className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-3">
          You don't have access to this
        </h1>

        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          {orgName} has this feature enabled, but your current role
          {user?.role ? <> (<strong className="text-gray-700">{user.role.replace(/_/g, ' ')}</strong>)</> : ''} does not include
          {permissionLabel ? <> permission to use <strong className="text-gray-700">{permissionLabel}</strong></> : ' the required permission'}.
          {requiredRole && (
            <> This requires the <strong className="text-gray-700">{requiredRole.replace(/_/g, ' ')}</strong> role.</>
          )}
        </p>

        {/* Contact box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 text-sm">
          <p className="text-amber-800 font-medium mb-2">Contact your Company Administrator to request access.</p>
          <div className="flex items-center justify-center gap-2 text-amber-700">
            <Mail className="w-4 h-4 shrink-0" />
            <span>Ask them to update your role or grant you permission.</span>
          </div>
        </div>

        {/* Role explanation */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-xs text-gray-500 text-left">
          <p className="font-medium text-gray-700 mb-1.5">How role permissions work:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>The Super Admin enables features for your organization</li>
            <li>Your Company Admin assigns roles that grant access to features</li>
            <li>If you need access, ask your Admin to update your role</li>
          </ul>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => history.back()}
            className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <a
            href="/support"
            className="h-10 px-4 grid place-items-center rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
