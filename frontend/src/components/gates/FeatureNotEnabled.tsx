'use client';
import Link from 'next/link';
import { Lock, Mail, MessageCircle, ArrowLeft } from 'lucide-react';

interface Props {
  featureLabel?: string;
  planRequired?: string;
}

/**
 * Message A — The organization doesn't have this feature enabled.
 * The user should contact the Super Admin (platform owner).
 */
export function FeatureNotEnabled({ featureLabel, planRequired }: Props) {
  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-slate-100 text-slate-400 mb-6">
          <Lock className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-3">
          This feature is not enabled
        </h1>

        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          {featureLabel ? (
            <>
              <strong className="text-gray-700">{featureLabel}</strong> is not included in your
              organization's current plan or has not been activated by the platform administrator.
            </>
          ) : (
            'This feature is not included in your current plan or has not been activated.'
          )}
          {planRequired && (
            <> It requires the <strong className="text-gray-700">{planRequired}</strong> plan or higher.</>
          )}
        </p>

        {/* Contact box */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 text-sm">
          <p className="text-gray-600 font-medium mb-3">Contact your ARTIC Super Admin to enable this:</p>
          <div className="space-y-2.5">
            <a
              href="mailto:byiringirofabrice6@gmail.com"
              className="flex items-center gap-2.5 justify-center text-gray-700 hover:text-blue-600 transition"
            >
              <Mail className="w-4 h-4 text-red-500 shrink-0" />
              byiringirofabrice6@gmail.com
            </a>
            <a
              href="https://wa.me/250787585826"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 justify-center text-gray-700 hover:text-green-600 transition"
            >
              <MessageCircle className="w-4 h-4 text-green-500 shrink-0" />
              +250 787 585 826 (WhatsApp)
            </a>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => history.back()}
            className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <Link
            href="/support"
            className="h-10 px-4 grid place-items-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
