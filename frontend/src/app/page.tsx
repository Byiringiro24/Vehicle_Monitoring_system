'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Truck, MapPin, Shield, Activity, Lock, Satellite, ArrowRight,
  CheckCircle, Zap, Globe, DollarSign, Users, Wrench, FileText,
  BarChart3, ChevronRight, Play, Building2, User, Star,
  MessageCircle, Phone, Mail,
} from 'lucide-react';

// ── Animation helpers ──────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08 } },
};

// ── Data ───────────────────────────────────────────────────────────────────────
const PATHWAYS = [
  {
    id: 'business',
    icon: <Building2 size={26} className="text-blue-600" />,
    bg:   'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-400',
    title: 'For Businesses',
    sub:   'Fleet companies & transport operators',
    desc:  'Register your company, manage your entire fleet, drivers, finances and compliance from one dashboard.',
    cta:   'Register your company',
    href:  '/register?type=company',
    points: ['GPS tracking for all vehicles', 'Driver & payroll management', 'Agreements & collections', 'Finance & P&L reports'],
  },
  {
    id: 'owner',
    icon: <Truck size={26} className="text-emerald-600" />,
    bg:   'bg-emerald-50',
    border: 'border-emerald-200 hover:border-emerald-400',
    title: 'For Vehicle Owners',
    sub:   'Individual owners with 1–20 vehicles',
    desc:  'List your vehicles, accept management proposals from companies, track your income and get payout statements.',
    cta:   'Create owner account',
    href:  '/register?type=personal&role=owner',
    points: ['Vehicle income tracking', 'Management proposals', 'Payout statements', 'Live GPS monitoring'],
  },
  {
    id: 'driver',
    icon: <User size={26} className="text-purple-600" />,
    bg:   'bg-purple-50',
    border: 'border-purple-200 hover:border-purple-400',
    title: 'For Drivers',
    sub:   'Employed & freelance drivers',
    desc:  'View your assigned vehicle, trips, earnings, documents and communicate directly with your fleet manager.',
    cta:   'Driver sign up',
    href:  '/register?type=personal&role=driver',
    points: ['Assigned vehicle details', 'Trip & earnings history', 'Document management', 'Direct manager contact'],
  },
  {
    id: 'customer',
    icon: <Star size={26} className="text-amber-600" />,
    bg:   'bg-amber-50',
    border: 'border-amber-200 hover:border-amber-400',
    title: 'For Customers',
    sub:   'Rent, hire or buy a vehicle',
    desc:  'Discover available vehicles, get quotes, manage your rental or hire-purchase agreement and make payments.',
    cta:   'Find a vehicle',
    href:  '/register?type=personal&role=customer',
    points: ['Browse available vehicles', 'Rental & hire-purchase', 'Agreement management', 'Payment history'],
  },
];

const FEATURES = [
  {
    icon: <MapPin size={22} className="text-blue-600" />,
    bg:   'bg-blue-50',
    title: 'Live GPS Tracking',
    desc:  'Every vehicle on a live map — speed, heading, location updated every 15 seconds over GPRS.',
  },
  {
    icon: <Lock size={22} className="text-red-600" />,
    bg:   'bg-red-50',
    title: 'Remote Engine Lock',
    desc:  'Lock or unlock the ignition relay from the dashboard. Plate confirmation required for safety.',
  },
  {
    icon: <Satellite size={22} className="text-green-600" />,
    bg:   'bg-green-50',
    title: 'Device Health Monitoring',
    desc:  'Ping any GPS unit to check it\'s online. Automatic offline detection after 3 minutes of silence.',
  },
  {
    icon: <Activity size={22} className="text-purple-600" />,
    bg:   'bg-purple-50',
    title: 'Smart Alerts',
    desc:  'Speeding, geofence breaches, insurance expiry, harsh braking — 17 alert types, fully configurable.',
  },
  {
    icon: <Shield size={22} className="text-orange-600" />,
    bg:   'bg-orange-50',
    title: 'Geofencing',
    desc:  'Draw zones on the map. Instant alerts when vehicles enter or exit. Polygons and circles supported.',
  },
  {
    icon: <DollarSign size={22} className="text-teal-600" />,
    bg:   'bg-teal-50',
    title: 'Financial Management',
    desc:  'Contracts, payments, driver payroll, fuel and maintenance costs — full P&L in one place.',
  },
  {
    icon: <Wrench size={22} className="text-amber-600" />,
    bg:   'bg-amber-50',
    title: 'Maintenance Schedules',
    desc:  'Service records, upcoming schedule reminders and full cost history per vehicle.',
  },
  {
    icon: <FileText size={22} className="text-pink-600" />,
    bg:   'bg-pink-50',
    title: 'Document Compliance',
    desc:  'Upload, verify and track insurance, licences and permits. Automatic expiry reminders.',
  },
  {
    icon: <BarChart3 size={22} className="text-indigo-600" />,
    bg:   'bg-indigo-50',
    title: 'Reports & Analytics',
    desc:  'Fleet performance, vehicle profitability, driver payroll and financial statements. CSV export.',
  },
];

const PLANS = [
  { name: 'Free',       price: '$0',   period: '/mo', seats: '3 users',   color: 'border-gray-200',  features: ['GPS tracking', 'Vehicle profiles', '3 users'] },
  { name: 'Starter',    price: '$19',  period: '/mo', seats: '10 users',  color: 'border-blue-300',  features: ['Everything in Free', 'Drivers & alerts', 'Basic reports', 'Email notifications'] },
  { name: 'Business',   price: '$49',  period: '/mo', seats: '25 users',  color: 'border-blue-500 ring-2 ring-blue-500/30', features: ['Everything in Starter', 'Finance & payroll', 'Maintenance', 'Documents & agreements', 'Geofencing'], highlight: true },
  { name: 'Enterprise', price: '$99',  period: '/mo', seats: '100 users', color: 'border-gray-200',  features: ['Everything in Business', 'AI assistant', 'Double-entry accounting', 'Custom roles', 'Priority support'] },
];

const STATS = [
  { value: '15s',    label: 'GPS refresh rate' },
  { value: '17',     label: 'Alert types' },
  { value: '6',      label: 'User roles' },
  { value: '100%',   label: 'Self-hosted' },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/30">
              <Truck size={18} className="text-white" />
            </div>
            <div>
              <span className="font-black text-gray-900 text-lg leading-none tracking-tight">
                ARTIC<span className="text-blue-600">.</span>VMS
              </span>
              <p className="text-[10px] text-gray-400 leading-none tracking-widest uppercase">Fleet Intelligence</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Link href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
              Sign In
            </Link>
            <Link href="/register"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-md shadow-blue-600/25">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
          {/* Mobile */}
          <Link href="/login" className="sm:hidden text-sm font-medium text-blue-600">Sign In</Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-20 px-6 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 text-white overflow-hidden relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 -left-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        </div>

        <motion.div
          className="max-w-3xl mx-auto text-center space-y-6 relative"
          initial="hidden" animate="show" variants={stagger}
        >
          <motion.div variants={fadeUp}
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium">
            <Zap size={13} className="text-yellow-300" /> Real-Time Fleet Intelligence Platform
          </motion.div>

          <motion.h1 variants={fadeUp}
            className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight">
            One Platform.<br />
            <span className="text-cyan-300">Every Role.</span>
          </motion.h1>

          <motion.p variants={fadeUp}
            className="text-lg text-blue-100 max-w-xl mx-auto leading-relaxed">
            ARTIC VMS brings together fleet companies, vehicle owners, drivers and customers
            into a single intelligent platform — with live GPS, finance, compliance and more.
          </motion.p>

          <motion.div variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/register"
              className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-8 py-4 rounded-2xl text-base transition shadow-xl shadow-blue-900/30">
              <ArrowRight size={18} /> Start for Free
            </Link>
            <Link href="/login"
              className="flex items-center gap-2 bg-white/10 border border-white/30 hover:bg-white/20 text-white font-semibold px-6 py-4 rounded-2xl text-base transition">
              <Play size={15} className="fill-white" /> Sign In
            </Link>
          </motion.div>

          {/* Stats strip */}
          <motion.div variants={fadeUp}
            className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {STATS.map(s => (
              <div key={s.label} className="bg-white/10 backdrop-blur border border-white/15 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-extrabold text-white">{s.value}</p>
                <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Who is ARTIC for? ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50" id="for-who">
        <motion.div
          className="max-w-6xl mx-auto"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">Built for everyone in the fleet ecosystem</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              One login. Different workspaces. Each person sees only what they need.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PATHWAYS.map(p => (
              <motion.div key={p.id} variants={fadeUp}
                className={`bg-white rounded-2xl border ${p.border} shadow-sm hover:shadow-lg transition-all duration-300 p-6 flex flex-col gap-4 group`}>
                <div className={`w-12 h-12 ${p.bg} rounded-xl flex items-center justify-center`}>
                  {p.icon}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.sub}</p>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">{p.desc}</p>
                <ul className="space-y-1.5">
                  {p.points.map(pt => (
                    <li key={pt} className="flex items-center gap-2 text-xs text-gray-500">
                      <CheckCircle size={12} className="text-blue-500 shrink-0" /> {pt}
                    </li>
                  ))}
                </ul>
                <Link href={p.href}
                  className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 text-sm font-semibold text-blue-600 group-hover:text-blue-700 transition">
                  {p.cta} <ChevronRight size={15} />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Features grid ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white" id="features">
        <motion.div
          className="max-w-6xl mx-auto"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">Everything to run your fleet</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Built for fleet managers, dispatchers, and business owners who need
              complete visibility and control.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <motion.div key={f.title} variants={fadeUp}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition p-5 flex gap-4">
                <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{f.title}</h3>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gray-50" id="pricing">
        <motion.div
          className="max-w-5xl mx-auto"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}
        >
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">Simple, transparent pricing</h2>
            <p className="text-gray-500 mt-3">Start free. Scale as your fleet grows. Cancel anytime.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {PLANS.map(plan => (
              <motion.div key={plan.name} variants={fadeUp}
                className={`bg-white rounded-2xl border ${plan.color} p-5 relative ${plan.highlight ? 'shadow-xl' : 'shadow-sm'}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">MOST POPULAR</span>
                  </div>
                )}
                <p className="font-bold text-gray-900">{plan.name}</p>
                <div className="mt-2 flex items-end gap-0.5">
                  <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-400 pb-0.5">{plan.period}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{plan.seats}</p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle size={12} className="text-blue-500 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`mt-5 block text-center text-sm font-semibold py-2.5 rounded-xl transition ${
                    plan.highlight
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}>
                  Get started
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.p variants={fadeUp} className="text-center text-xs text-gray-400 mt-6">
            Plans activated by Super Admin after registration review. Self-hosted — no transaction fees.
          </motion.p>
        </motion.div>
      </section>

      {/* ── Why ARTIC — hardware + self-hosting ─────────────────────────────── */}
      <section className="py-20 px-6 bg-white">
        <motion.div
          className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}
        >
          <motion.div variants={fadeUp} className="space-y-5">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Zap size={12} /> Low cost. High control.
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900">Built for the real world</h2>
            <p className="text-gray-500 leading-relaxed">
              ARTIC VMS works with affordable ESP32 + SIM808 GPS hardware over 2G/GPRS —
              making it accessible for fleets of any size, from a single motorcycle to hundreds of trucks.
            </p>
            <ul className="space-y-3">
              {[
                'Works with any SIM card and GPRS connection',
                'ESP32 + SIM808 hardware under $15 per vehicle',
                'Self-hosted — your data stays on your server',
                'MQTT-based real-time comms on slow 2G networks',
                'No per-vehicle subscription fees ever',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <CheckCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition shadow-md shadow-blue-600/25">
              Register your organization <ArrowRight size={14} />
            </Link>
          </motion.div>

          <motion.div variants={fadeUp}
            className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-2xl shadow-blue-600/20">
            <div className="text-5xl font-black mb-1">$0</div>
            <p className="text-blue-200 text-sm mb-6">Platform license — host it yourself</p>
            <div className="space-y-3 text-sm">
              {[
                '✓ Unlimited vehicles',
                '✓ Unlimited GPS history',
                '✓ Real-time Engine lock',
                '✓ Full financial module',
                '✓ Driver & customer portals',
                '✓ Open source hardware',
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-blue-50">
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <Link href="/login"
              className="mt-6 block text-center bg-white text-blue-700 font-bold py-3 rounded-xl hover:bg-blue-50 transition text-sm">
              Access your dashboard →
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Contact strip ───────────────────────────────────────────────────── */}
      <section className="py-14 px-6 bg-gray-50 border-y border-gray-100">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
        >
          <motion.h2 variants={fadeUp} className="text-2xl font-extrabold text-gray-900 mb-2">
            Have a question before registering?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-500 text-sm mb-6">
            Reach us directly — we respond to all enquiries.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
            <a href="https://wa.me/250787585826" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-50 border border-green-200 hover:border-green-400 text-green-700 font-medium text-sm px-4 py-2.5 rounded-xl transition">
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a href="tel:+250787585826"
              className="flex items-center gap-2 bg-blue-50 border border-blue-200 hover:border-blue-400 text-blue-700 font-medium text-sm px-4 py-2.5 rounded-xl transition">
              <Phone size={16} /> +250 787 585 826
            </a>
            <a href="mailto:byiringirofabrice6@gmail.com"
              className="flex items-center gap-2 bg-red-50 border border-red-200 hover:border-red-400 text-red-700 font-medium text-sm px-4 py-2.5 rounded-xl transition">
              <Mail size={16} /> Email us
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white text-center">
        <motion.div
          className="max-w-2xl mx-auto space-y-6"
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}
        >
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold">
            Ready to take control of your fleet?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-blue-100 text-lg">
            Register your organization and start monitoring your vehicles in real time.
            Approval usually takes less than 24 hours.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-8 py-4 rounded-2xl text-base transition shadow-xl shadow-blue-900/30">
              <ArrowRight size={18} /> Register Free
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 bg-white/10 border border-white/30 hover:bg-white/20 text-white font-semibold px-6 py-4 rounded-2xl text-base transition">
              Sign In to Dashboard
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-400 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
            {/* Brand */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Truck size={15} className="text-white" />
                </div>
                <span className="font-black text-white text-lg tracking-tight">ARTIC<span className="text-blue-400">.</span>VMS</span>
              </div>
              <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                Real-time fleet intelligence platform for transport companies, vehicle owners, drivers and customers.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="space-y-2">
                <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Platform</p>
                {['For Businesses', 'For Vehicle Owners', 'For Drivers', 'For Customers'].map(l => (
                  <p key={l}><Link href="/register" className="hover:text-white transition">{l}</Link></p>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Account</p>
                {[['Sign In', '/login'], ['Register', '/register'], ['Support', '/support']].map(([l, h]) => (
                  <p key={l}><Link href={h} className="hover:text-white transition">{l}</Link></p>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
            <p>© {new Date().getFullYear()} ARTIC VMS. All rights reserved.</p>
            <p>Vehicle Monitoring System — Real-time fleet intelligence</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
