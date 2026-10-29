'use client';
import Link from 'next/link';
import { FEATURE_CATALOG, type PlanTier } from '@/lib/featureCatalog';
import { Mail, MessageCircle, ArrowLeft, CheckCircle, Sparkles, ArrowRight } from 'lucide-react';

interface Props {
  featureCode?: string;
  planRequired?: string;
}

/**
 * Attractive upsell page — shown when a user clicks a feature their plan doesn't include.
 * Instead of just "contact Super Admin", this shows what the feature does,
 * why it's useful, and makes the user want to upgrade.
 */
export function FeatureNotEnabled({ featureCode, planRequired }: Props) {
  const feature = featureCode ? FEATURE_CATALOG[featureCode] : null;

  // If we don't have catalog info, show the generic version
  if (!feature) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto grid place-items-center rounded-full bg-slate-100 text-slate-400 mb-6">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-3">
            This feature is not in your current plan
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Your organization's plan doesn't include this feature. Contact your ARTIC Super Admin to upgrade.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-sm">
            <p className="text-gray-600 font-medium mb-3">Contact your ARTIC Super Admin:</p>
            <div className="space-y-2">
              <a href="mailto:byiringirofabrice6@gmail.com" className="flex items-center gap-2 justify-center text-gray-700 hover:text-blue-600 transition">
                <Mail className="w-4 h-4 text-red-500 shrink-0" /> byiringirofabrice6@gmail.com
              </a>
              <a href="https://wa.me/250787585826" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 justify-center text-gray-700 hover:text-green-600 transition">
                <MessageCircle className="w-4 h-4 text-green-500 shrink-0" /> +250 787 585 826 (WhatsApp)
              </a>
            </div>
          </div>
          <button onClick={() => history.back()} className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition mx-auto">
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Attractive upsell with feature details ────────────────────────────────
  return (
    <div className="min-h-[60vh] py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Hero card */}
        <div className="bg-gradient-to-br from-brand-50 to-blue-50 border border-brand-200 rounded-2xl p-6 mb-5 text-center">
          <div className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-4">
            <Sparkles size={11} /> AVAILABLE ON {feature.minPlan} PLAN
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">{feature.name}</h1>
          <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">{feature.description}</p>
        </div>

        {/* Benefits list */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-5">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" /> What you get with {feature.name}
          </h2>
          <ul className="space-y-3">
            {feature.benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                </div>
                <span className="text-sm text-gray-700 leading-relaxed">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Upgrade CTA */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-5">
          <h2 className="font-bold text-amber-900 mb-1">Upgrade to {feature.minPlan} to unlock this</h2>
          <p className="text-sm text-amber-700 mb-4">
            Your current plan doesn't include <strong>{feature.name}</strong>. 
            Contact your ARTIC Super Admin to enable it — it takes less than 5 minutes.
          </p>
          <div className="space-y-2.5">
            <a href="mailto:byiringirofabrice6@gmail.com"
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-300 transition group">
              <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Email Super Admin</p>
                <p className="text-xs text-gray-400">byiringirofabrice6@gmail.com</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition shrink-0" />
            </a>
            <a href="https://wa.me/250787585826" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-green-300 transition group">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">WhatsApp</p>
                <p className="text-xs text-gray-400">+250 787 585 826</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition shrink-0" />
            </a>
          </div>
        </div>

        {/* Plan comparison teaser */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center">
          <p className="text-xs text-gray-400 mb-3">All ARTIC VMS plans</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(['FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE'] as PlanTier[]).map(plan => {
              const isCurrentOrBelow = plan === feature.minPlan;
              const isAbove = (['FREE','STARTER','BUSINESS','ENTERPRISE'] as PlanTier[]).indexOf(plan) >=
                              (['FREE','STARTER','BUSINESS','ENTERPRISE'] as PlanTier[]).indexOf(feature.minPlan);
              return (
                <span key={plan} className={`text-xs px-3 py-1 rounded-full font-medium ${
                  isAbove ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {plan}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {feature.minPlan} and above include <strong>{feature.name}</strong>
          </p>
        </div>

        {/* Back button */}
        <div className="text-center mt-5">
          <button onClick={() => history.back()} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
            <ArrowLeft className="w-4 h-4" /> Go back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
