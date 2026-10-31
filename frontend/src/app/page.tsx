'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Truck, MapPin, Shield, Activity, Lock, Satellite, ArrowRight,
  CheckCircle, Zap, Globe, DollarSign, Users, Wrench, FileText,
  BarChart3, ChevronRight, Building2, User, Star,
  MessageCircle, Phone, Mail, ChevronDown, Menu, X,
} from 'lucide-react';

// ── Load hero animation client-side only (SVG SMIL, no SSR needed) ───────────
const HeroAnimation = dynamic(
  () => import('@/components/landing/HeroAnimation').then(m => ({ default: m.HeroAnimation })),
  { ssr: false, loading: () => <div className="w-full h-full bg-navy-800/60 rounded-2xl animate-pulse" /> }
);

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
    id: 'business', icon: <Building2 size={24} className="text-blue-600" />,
    bg: 'bg-blue-50', border: 'border-blue-200 hover:border-blue-400',
    title: 'For Businesses', sub: 'Fleet companies & transport operators',
    desc: 'Manage your entire fleet, drivers, finances and compliance from one dashboard.',
    cta: 'Register your company', href: '/register?type=company',
    points: ['GPS tracking for all vehicles', 'Driver & payroll management', 'Agreements & collections', 'Finance & P&L reports'],
  },
  {
    id: 'owner', icon: <Truck size={24} className="text-emerald-600" />,
    bg: 'bg-emerald-50', border: 'border-emerald-200 hover:border-emerald-400',
    title: 'For Vehicle Owners', sub: 'Individual owners with 1–20 vehicles',
    desc: 'Track your income, expenses, and get management proposals from companies.',
    cta: 'Create owner account', href: '/register?type=personal&role=owner',
    points: ['Vehicle income tracking', 'Management proposals', 'Payout statements', 'Live GPS monitoring'],
  },
  {
    id: 'driver', icon: <User size={24} className="text-purple-600" />,
    bg: 'bg-purple-50', border: 'border-purple-200 hover:border-purple-400',
    title: 'For Drivers', sub: 'Employed & freelance drivers',
    desc: 'View your assigned vehicle, trips, earnings and communicate with your manager.',
    cta: 'Driver sign up', href: '/register?type=personal&role=driver',
    points: ['Assigned vehicle details', 'Trip & earnings history', 'Document management', 'Direct manager contact'],
  },
  {
    id: 'customer', icon: <Star size={24} className="text-amber-600" />,
    bg: 'bg-amber-50', border: 'border-amber-200 hover:border-amber-400',
    title: 'For Customers', sub: 'Rent, hire or buy a vehicle',
    desc: 'Discover available vehicles, get quotes and manage your rental or hire-purchase.',
    cta: 'Find a vehicle', href: '/register?type=personal&role=customer',
    points: ['Browse available vehicles', 'Rental & hire-purchase', 'Agreement management', 'Payment history'],
  },
];

const FEATURES = [
  { icon: <MapPin size={20} className="text-blue-600" />,    bg: 'bg-blue-50',   title: 'Live GPS Tracking',     desc: "Every vehicle on a live map — speed, heading, location updated every 15 seconds over GPRS." },
  { icon: <Lock size={20} className="text-red-600" />,       bg: 'bg-red-50',    title: 'Remote Engine Lock',    desc: 'Lock or unlock the ignition relay from the dashboard. Plate confirmation required for safety.' },
  { icon: <Satellite size={20} className="text-green-600" />,bg: 'bg-green-50',  title: 'Device Monitoring',     desc: "Ping any GPS unit to check it's online. Auto offline detection after 3 minutes of silence." },
  { icon: <Activity size={20} className="text-purple-600" />,bg: 'bg-purple-50', title: 'Smart Alerts',          desc: 'Speeding, geofence breaches, insurance expiry — 17 alert types, fully configurable.' },
  { icon: <Shield size={20} className="text-orange-600" />,  bg: 'bg-orange-50', title: 'Geofencing',            desc: 'Draw zones on the map. Instant alerts when vehicles enter or exit. Polygons and circles.' },
  { icon: <DollarSign size={20} className="text-teal-600" />,bg: 'bg-teal-50',   title: 'Financial Management',  desc: 'Contracts, payments, driver payroll, fuel and maintenance costs — full P&L in one place.' },
  { icon: <Wrench size={20} className="text-amber-600" />,   bg: 'bg-amber-50',  title: 'Maintenance',          desc: 'Service records, upcoming schedule reminders and full cost history per vehicle.' },
  { icon: <FileText size={20} className="text-pink-600" />,  bg: 'bg-pink-50',   title: 'Document Compliance',  desc: 'Upload, verify and track insurance, licences and permits. Automatic expiry reminders.' },
  { icon: <BarChart3 size={20} className="text-indigo-600" />,bg: 'bg-indigo-50',title: 'Reports & Analytics',  desc: 'Fleet performance, vehicle profitability, driver payroll and financial statements.' },
];

const PLANS = [
  { name: 'Free',       price: '$0',  period: '/mo', seats: '3 users',   color: 'border-gray-200',  features: ['GPS tracking', 'Vehicle profiles', '3 users'] },
  { name: 'Starter',    price: '$19', period: '/mo', seats: '10 users',  color: 'border-blue-300',  features: ['Everything in Free', 'Drivers & alerts', 'Basic reports', 'Email notifications'] },
  { name: 'Business',   price: '$49', period: '/mo', seats: '25 users',  color: 'border-blue-500 ring-2 ring-blue-500/20', features: ['Everything in Starter', 'Finance & payroll', 'Maintenance', 'Documents & agreements'], highlight: true },
  { name: 'Enterprise', price: '$99', period: '/mo', seats: '100 users', color: 'border-gray-200',  features: ['Everything in Business', 'AI assistant', 'Double-entry accounting', 'Custom roles'] },
];

const STATS = [
  { value: '15s', label: 'GPS refresh rate' },
  { value: '17',  label: 'Alert types' },
  { value: '6',   label: 'User roles' },
  { value: '24/7', label: 'Fleet visibility' },
];

const FAQ = [
  { q: 'Do I need a separate account to be a driver or owner?',
    a: 'No. ARTIC uses one account per person. You can be a customer, a driver, a vehicle owner and a company admin with a single sign-in.' },
  { q: 'How long does company approval take?',
    a: 'Most applications are reviewed within 1–2 business days. You\'ll receive an email when approved.' },
  { q: 'Can I switch between companies?',
    a: 'Yes. If you have roles in multiple companies, you\'ll see a workspace switcher in the top bar.' },
  { q: 'Is my data visible to other companies?',
    a: 'No. Each company\'s data is fully isolated. Your vehicles, contracts and financials are never visible to others.' },
  { q: 'Which countries are supported?',
    a: 'Launching first in Rwanda, with additional countries being configured. Contact support for availability in your area.' },
];

// ── Nav ────────────────────────────────────────────────────────────────────────
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'glass-nav' : 'bg-transparent'}`}>
      <nav className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Truck size={18} className="text-white" />
          </div>
          <span className="font-black text-white text-lg tracking-tight leading-none">
            ARTIC<span className="text-cyan-400">.</span>VMS
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-7 text-sm text-white/75">
          {[['Services', '#features'], ['For Businesses', '/register?type=company'], ['For Owners', '/register?type=personal&role=owner'], ['Pricing', '#pricing'], ['About', '#']].map(([label, href]) => (
            <a key={label} href={href} className="hover:text-white transition">{label}</a>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <Link href="/login"
            className="h-9 px-4 text-sm font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition">
            Sign In
          </Link>
          <Link href="/register"
            className="h-9 px-4 flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-md shadow-blue-600/30">
            Get Started <ArrowRight size={13} />
          </Link>
        </div>

        {/* Mobile */}
        <button onClick={() => setMenuOpen(true)} className="lg:hidden text-white p-1.5" aria-label="Open menu">
          <Menu size={22} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-navy-950/95 flex flex-col p-6">
          <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-4 text-white p-2" aria-label="Close">
            <X size={22} />
          </button>
          <div className="mt-14 flex flex-col gap-5 text-white text-xl font-medium">
            {[['Services', '#features'], ['For Businesses', '/register?type=company'], ['For Owners', '/register?type=personal&role=owner'], ['For Drivers', '/register?type=personal&role=driver'], ['Pricing', '#pricing']].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMenuOpen(false)}>{label}</a>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3">
            <Link href="/login" onClick={() => setMenuOpen(false)} className="h-12 grid place-items-center rounded-xl border border-white/30 text-white font-medium">Sign In</Link>
            <Link href="/register" onClick={() => setMenuOpen(false)} className="h-12 grid place-items-center rounded-xl bg-blue-600 text-white font-semibold">Get Started</Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ── FAQ accordion item ─────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
        aria-expanded={open}>
        <span className="font-medium text-gray-900 text-sm">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ml-3 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-200 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <LandingNav />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative hero-bg overflow-hidden">
        <div className="absolute inset-0 hero-vignette pointer-events-none" />

        <motion.div
          className="relative max-w-7xl mx-auto px-5 pt-28 pb-20 lg:pt-36 lg:pb-28"
          initial="hidden" animate="show" variants={stagger}
        >
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
            {/* Left — text */}
            <div className="text-white">
              <motion.div variants={fadeUp}
                className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-xs font-medium mb-5">
                <Zap size={11} className="text-yellow-300" /> Real-Time Fleet Intelligence Platform
              </motion.div>

              <motion.h1 variants={fadeUp}
                className="text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.08] tracking-tight">
                One Platform.<br />
                <span className="text-cyan-400">Every Role.</span>
              </motion.h1>

              <motion.p variants={fadeUp}
                className="mt-5 text-lg text-white/75 max-w-xl leading-relaxed">
                Manage vehicles, grow your transport business, connect with trusted
                service providers — with live GPS, finance, compliance and more.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                <Link href="/register"
                  className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-7 py-3.5 rounded-2xl text-sm transition shadow-xl shadow-blue-900/30 active:scale-[0.98]">
                  <ArrowRight size={16} /> Start for Free
                </Link>
                <Link href="/login"
                  className="flex items-center gap-2 bg-white/10 border border-white/30 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-2xl text-sm transition">
                  Sign In to Dashboard
                </Link>
              </motion.div>

              {/* Stats strip */}
              <motion.div variants={fadeUp} className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg">
                {STATS.map(s => (
                  <div key={s.label} className="bg-white/10 border border-white/15 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xl font-extrabold text-white tabular">{s.value}</p>
                    <p className="text-[10px] text-blue-200 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right — animated map canvas */}
            <motion.div variants={fadeUp}
              className="relative aspect-[4/3] lg:aspect-auto lg:h-[460px] rounded-2xl overflow-hidden border border-white/10 shadow-dark">
              <HeroAnimation />
              {/* Live indicator overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-[10px] text-white/90 font-medium">Live tracking</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Pathways ───────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-gray-50" id="services">
        <motion.div className="max-w-6xl mx-auto"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">Built for everyone in the fleet ecosystem</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">One login. Different workspaces. Each person sees only what they need.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PATHWAYS.map(p => (
              <motion.div key={p.id} variants={fadeUp}
                className={`bg-white rounded-2xl border ${p.border} shadow-sm hover:shadow-lg transition-all duration-300 p-6 flex flex-col gap-4 group`}>
                <div className={`w-12 h-12 ${p.bg} rounded-xl flex items-center justify-center`}>{p.icon}</div>
                <div>
                  <p className="font-bold text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.sub}</p>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">{p.desc}</p>
                <ul className="space-y-1.5">
                  {p.points.map(pt => (
                    <li key={pt} className="flex items-center gap-2 text-xs text-gray-500">
                      <CheckCircle size={11} className="text-blue-500 shrink-0" /> {pt}
                    </li>
                  ))}
                </ul>
                <Link href={p.href}
                  className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 text-sm font-semibold text-blue-600 group-hover:text-blue-700 transition">
                  {p.cta} <ChevronRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-white" id="features">
        <motion.div className="max-w-6xl mx-auto"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">Everything to run your fleet</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm">Complete visibility and control for fleet managers, dispatchers, and business owners.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <motion.div key={f.title} variants={fadeUp}
                className="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition p-5 flex gap-4">
                <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>{f.icon}</div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">{f.title}</h3>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-gray-50" id="pricing">
        <motion.div className="max-w-5xl mx-auto"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">Simple, transparent pricing</h2>
            <p className="text-gray-500 mt-3 text-sm">Start free. Scale as your fleet grows. Activated by Super Admin after registration.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {PLANS.map(plan => (
              <motion.div key={plan.name} variants={fadeUp}
                className={`bg-white rounded-2xl border ${plan.color} p-5 relative ${plan.highlight ? 'shadow-xl' : 'shadow-xs'}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-[9px] font-bold px-3 py-0.5 rounded-full shadow">POPULAR</span>
                  </div>
                )}
                <p className="font-bold text-gray-900">{plan.name}</p>
                <div className="mt-1.5 flex items-end gap-0.5">
                  <span className="text-3xl font-extrabold text-gray-900 tabular">{plan.price}</span>
                  <span className="text-xs text-gray-400 pb-0.5">{plan.period}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{plan.seats}</p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle size={11} className="text-blue-500 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`mt-5 block text-center text-sm font-semibold py-2.5 rounded-xl transition ${
                    plan.highlight ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}>
                  Get started
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Why ARTIC ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-white">
        <motion.div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center"
          initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="space-y-5">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Zap size={11} /> Built for growing fleets.
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900">Scalable fleet management for real operations</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              ARTIC VMS gives transport businesses a single system to manage drivers, vehicles, alerts, contracts, and performance across the full lifecycle of each asset.
            </p>
            <ul className="space-y-3">
              {['Flexible for single-owner fleets and large operators', 'Live tracking, alerts, and operational visibility', 'Finance, payroll, and compliance in one platform', 'Designed to scale from a few vehicles to hundreds'].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <CheckCircle size={15} className="text-blue-600 mt-0.5 shrink-0" /> {item}
                </li>
              ))}
            </ul>
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition shadow-md shadow-blue-600/25">
              Register your organization <ArrowRight size={13} />
            </Link>
          </motion.div>

          <motion.div variants={fadeUp}
            className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl shadow-blue-600/20">
            <div className="text-5xl font-black mb-1 tabular">$0</div>
            <p className="text-blue-200 text-sm mb-6">Access to the platform</p>
            <div className="space-y-2.5 text-sm">
              {['✓ Unlimited vehicles', '✓ Unlimited GPS history', '✓ Real-time engine lock', '✓ Full financial module', '✓ Driver & customer portals', '✓ Operational reporting'].map(f => (
                <div key={f} className="text-blue-50">{f}</div>
              ))}
            </div>
            <Link href="/login"
              className="mt-6 block text-center bg-white text-blue-700 font-bold py-3 rounded-xl hover:bg-blue-50 transition text-sm">
              Access your dashboard →
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Contact strip ──────────────────────────────────────────────── */}
      <section className="py-14 px-5 bg-gray-50 border-y border-gray-100">
        <motion.div className="max-w-3xl mx-auto text-center"
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-2xl font-extrabold text-gray-900 mb-2">
            Have a question before registering?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-500 text-sm mb-6">
            Reach us directly — we respond to all enquiries.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
            <a href="https://wa.me/250787585826" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-50 border border-green-200 hover:border-green-400 text-green-700 font-medium text-sm px-4 py-2.5 rounded-xl transition">
              <MessageCircle size={15} /> WhatsApp
            </a>
            <a href="tel:+250787585826"
              className="flex items-center gap-2 bg-blue-50 border border-blue-200 hover:border-blue-400 text-blue-700 font-medium text-sm px-4 py-2.5 rounded-xl transition">
              <Phone size={15} /> +250 787 585 826
            </a>
            <a href="mailto:byiringirofabrice6@gmail.com"
              className="flex items-center gap-2 bg-red-50 border border-red-200 hover:border-red-400 text-red-700 font-medium text-sm px-4 py-2.5 rounded-xl transition">
              <Mail size={15} /> Email us
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-10">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white text-center">
        <motion.div className="max-w-2xl mx-auto space-y-6"
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-4xl font-extrabold">Ready to take control of your fleet?</motion.h2>
          <motion.p variants={fadeUp} className="text-blue-100 text-lg">
            Register your organization and start monitoring in real time. Approval usually takes less than 24 hours.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold px-8 py-4 rounded-2xl text-base transition shadow-xl shadow-blue-900/30">
              <ArrowRight size={17} /> Register Free
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 bg-white/10 border border-white/30 hover:bg-white/20 text-white font-semibold px-6 py-4 rounded-2xl text-base transition">
              Sign In to Dashboard
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-navy-950 text-gray-400 py-12 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-8">
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
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div className="space-y-2">
                <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Platform</p>
                {[['For Businesses', '/register?type=company'], ['For Vehicle Owners', '/register?type=personal&role=owner'], ['For Drivers', '/register?type=personal&role=driver'], ['For Customers', '/register?type=personal&role=customer']].map(([l, h]) => (
                  <p key={l}><Link href={h} className="hover:text-white transition">{l}</Link></p>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Account</p>
                {[['Sign In', '/login'], ['Register', '/register'], ['Support', '/support'], ['Help', '#']].map(([l, h]) => (
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
