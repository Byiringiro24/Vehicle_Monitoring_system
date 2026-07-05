'use client';
import Link from 'next/link';
import { Truck, MapPin, Shield, Activity, Lock, Satellite,
  ArrowRight, CheckCircle, Zap, Globe } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Truck size={20} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-lg leading-none">ARTIC VMS</span>
              <p className="text-xs text-gray-500 leading-none">Vehicle Monitoring System</p>
            </div>
          </div>
          <Link href="/login"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
            Sign In <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium">
            <Zap size={13} className="text-yellow-300" /> Real-Time Fleet Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Know Where Your<br />Fleet Is. Always.
          </h1>
          <p className="text-xl text-blue-100 max-w-xl mx-auto leading-relaxed">
            ARTIC VMS gives you live GPS tracking, engine lock/unlock control,
            geofencing, driver management and full financial oversight — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/login"
              className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-8 py-4 rounded-2xl text-base transition shadow-lg">
              <ArrowRight size={18} /> Sign In to Dashboard
            </Link>
          </div>
        </div>

        {/* Dashboard preview card */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Live GPS', icon: <MapPin size={22} />, desc: 'Real-time positions' },
              { label: 'Engine Lock', icon: <Lock size={22} />, desc: 'Remote relay control' },
              { label: 'Alerts', icon: <Activity size={22} />, desc: 'Instant notifications' },
              { label: 'Geofences', icon: <Globe size={22} />, desc: 'Zone monitoring' },
            ].map(({ label, icon, desc }) => (
              <div key={label} className="space-y-2">
                <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mx-auto">
                  {icon}
                </div>
                <p className="font-bold text-sm">{label}</p>
                <p className="text-xs text-blue-200">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Everything You Need to Run Your Fleet</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Built for fleet managers, dispatchers, and business owners who need
              complete visibility and control over their vehicles.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <MapPin size={22} className="text-blue-600" />,
                title: 'Live GPS Tracking',
                desc: 'See every vehicle\'s exact position on a live map. Speed, heading, and location updated every 15 seconds via SIM808 GPS modules.',
                color: 'bg-blue-50',
              },
              {
                icon: <Lock size={22} className="text-red-600" />,
                title: 'Remote Engine Lock',
                desc: 'Lock or unlock the ignition relay from the dashboard. Plate number confirmation required for safety. Commands delivered via MQTT in real time.',
                color: 'bg-red-50',
              },
              {
                icon: <Satellite size={22} className="text-green-600" />,
                title: 'GPS Module Monitoring',
                desc: 'Ping any GPS device to check if it\'s online. Automatic offline detection marks vehicles inactive if no telemetry arrives for 3 minutes.',
                color: 'bg-green-50',
              },
              {
                icon: <Activity size={22} className="text-purple-600" />,
                title: 'Smart Alerts',
                desc: 'Get notified for speeding, geofence breaches, insurance expiry, harsh braking, and more. Rules are fully configurable.',
                color: 'bg-purple-50',
              },
              {
                icon: <Shield size={22} className="text-orange-600" />,
                title: 'Geofencing',
                desc: 'Draw zones on the map. Receive instant alerts when vehicles enter or exit defined areas. Supports polygons and circles.',
                color: 'bg-orange-50',
              },
              {
                icon: <Globe size={22} className="text-teal-600" />,
                title: 'Financial Management',
                desc: 'Track contracts, rental payments, driver payroll, fuel costs, maintenance expenses and view full P&L statements.',
                color: 'bg-teal-50',
              },
            ].map(({ icon, title, desc, color }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition space-y-3">
                <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center`}>{icon}</div>
                <h3 className="font-bold text-gray-900">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why ARTIC ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-5">
            <h2 className="text-3xl font-bold text-gray-900">Built for the Real World</h2>
            <p className="text-gray-500 leading-relaxed">
              ARTIC VMS is designed to work with affordable SIM808 GPS hardware over GPRS,
              making it accessible for fleets of all sizes — from a single vehicle to hundreds.
            </p>
            <ul className="space-y-3">
              {[
                'Works with any SIM card and GPRS connection',
                'ESP32 + SIM808 hardware costs under $15 per vehicle',
                'No subscription fees for the platform',
                'Self-hosted on your own server for full data control',
                'MQTT-based — works even on slow 2G networks',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <CheckCircle size={17} className="text-blue-600 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white space-y-6">
            <div className="text-4xl font-extrabold">$0</div>
            <p className="text-blue-100 text-sm">Platform cost — host it yourself</p>
            <div className="space-y-3 text-sm">
              {[
                '✓ Unlimited vehicles',
                '✓ Unlimited users',
                '✓ Real-time GPS updates',
                '✓ Engine lock/unlock',
                '✓ Full financial module',
                '✓ Open source hardware',
              ].map(f => <p key={f} className="text-blue-50">{f}</p>)}
            </div>
            <Link href="/login"
              className="block text-center bg-white text-blue-700 font-bold py-3 rounded-xl hover:bg-blue-50 transition text-sm">
              Access Dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-blue-600 text-white text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold">Ready to take control of your fleet?</h2>
          <p className="text-blue-100">Sign in to your ARTIC VMS dashboard and start monitoring your vehicles in real time.</p>
          <Link href="/login"
            className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-8 py-4 rounded-2xl text-base transition shadow-lg">
            <ArrowRight size={18} /> Go to Dashboard
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-6 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Truck size={14} className="text-white" />
          </div>
          <span className="font-semibold text-white">ARTIC VMS</span>
        </div>
        <p>Vehicle Monitoring System — Real-time fleet intelligence</p>
        <p className="mt-2 text-gray-600">© {new Date().getFullYear()} ARTIC. All rights reserved.</p>
      </footer>
    </div>
  );
}
