'use client';
import { ArrowUpRight, BadgeCheck, Check, FileCheck2, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';

type Props = { catalogCount?: number; cityCount?: number; onConnect?: () => void; connected?: boolean; connecting?: boolean; availability?: 'loading' | 'ready' | 'error' | 'unconfigured' };

export function AboutBento({ catalogCount = 48, cityCount = 8, onConnect, connected = false, connecting = false, availability = 'unconfigured' }: Props = {}) {
  const status = availability === 'ready' ? 'Ready on Monad Testnet' : availability === 'loading' ? 'Checking availability…' : availability === 'error' ? 'Availability temporarily unavailable' : 'Contract setup pending';
  return <section id="how" className="about-bento py-20 sm:py-24" aria-labelledby="booking-steps-title">
    <div className="container">
      <div className="mx-auto mb-12 max-w-[680px] text-center">
        <span className="text-[11px] font-bold tracking-[.14em] text-[#6746d9] uppercase">How the testnet booking works</span>
        <h2 id="booking-steps-title" className="mt-4 mb-5 text-[40px] font-bold leading-[1.08] tracking-[-.045em] sm:text-[56px]">Four clear steps.</h2>
        <p className="text-[15px] leading-7 text-[#766f65]">Free homes share one booking record; paid homes hold rent and deposit in escrow. These illustrative listings do not grant real tenancy.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:auto-rows-[270px] lg:grid-cols-4">
        <Card data-bento-card="discover" className="group relative flex min-h-[400px] flex-col justify-between overflow-clip rounded-[24px] border-[#dedbd5] bg-white p-7 md:col-span-2 md:p-10 lg:row-span-2">
          <svg width="377" height="368" viewBox="0 0 377 368" className="pointer-events-none absolute -right-20 -bottom-20 h-auto w-[330px] fill-[#f0edf6] motion-safe:transition-transform motion-safe:duration-[2000ms] motion-safe:group-hover:rotate-180" aria-hidden="true" focusable="false">
            <path d="M179.692 5.79814C182.635 -1.93287 193.572 -1.93285 196.515 5.79816L229.505 92.466C231.206 96.9342 236.103 99.2928 240.657 97.8366L328.986 69.5929C336.865 67.0735 343.684 75.6242 339.474 82.7452L292.284 162.574C289.851 166.69 291.061 171.99 295.038 174.642L372.192 226.091C379.075 230.68 376.641 241.343 368.449 242.491L276.613 255.369C271.878 256.033 268.489 260.283 268.895 265.047L276.776 357.445C277.479 365.688 267.625 370.433 261.619 364.744L194.293 300.973C190.821 297.686 185.386 297.686 181.914 300.973L114.588 364.744C108.582 370.433 98.7281 365.688 99.4311 357.445L107.312 265.047C107.718 260.283 104.329 256.033 99.5941 255.369L7.7582 242.491C-0.433812 241.343 -2.86746 230.68 4.01488 226.091L81.1687 174.642C85.1465 171.99 86.3561 166.69 83.9231 162.574L36.7325 82.7452C32.523 75.6242 39.342 67.0735 47.2212 69.5929L135.55 97.8366C140.104 99.2928 145.001 96.9342 146.702 92.4659L179.692 5.79814Z" />
          </svg>
          <div className="relative z-10">
            <span className="inline-flex rounded-full bg-[#6746d9] px-4 py-2 text-[10px] font-bold tracking-[.12em] text-white uppercase">01 · Home discovery</span>
            <h3 className="mt-7 text-[32px] font-bold leading-[1.08] tracking-[-.045em] sm:text-[52px]">Choose a home.<br/><span className="text-[#6746d9]">Find your nest.</span></h3>
            <p className="mt-5 max-w-[350px] text-[15px] leading-7 text-[#766f65]">Open a listing to see its live availability or its escrow terms on Monad Testnet.</p>
          </div>
          <div className="relative z-10 mt-8">
            <div className="mb-6 flex gap-8 border-t border-[#dedbd5] pt-5">
              <div><strong className="block text-[32px] leading-none">{catalogCount}</strong><span className="mt-2 block text-xs text-[#766f65]">Illustrative homes</span></div>
              <div><strong className="block text-[32px] leading-none">{cityCount}</strong><span className="mt-2 block text-xs text-[#766f65]">Cities to explore</span></div>
            </div>
            <a href="#homes" className="bento-explore inline-flex min-h-11 items-center gap-3 rounded-full bg-[#17130f] px-5 py-3 text-[13px] font-bold text-white">Explore homes <ArrowUpRight size={17} aria-hidden="true"/></a>
          </div>
        </Card>
        <Card data-bento-card="wallet" className="flex min-h-[270px] flex-col justify-between gap-4 rounded-[24px] border-none bg-[#d8ff5f] p-6 text-[#17130f]">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-[.12em] uppercase">02 · Your wallet</span><Wallet size={22} aria-hidden="true"/></div>
          <div><h3 className="text-[25px] font-bold leading-[1.15] tracking-[-.035em]">Connect your wallet</h3><p className="mt-3 text-[13px] leading-5 text-[#4e5a28]">Review the amount and network gas before approving.</p></div>
          <button type="button" onClick={onConnect} disabled={connected || connecting || !onConnect} aria-busy={connecting} className="bento-wallet-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#17130f26] bg-white px-4 py-2 disabled:cursor-default disabled:opacity-80">{connected ? <><Check size={16} aria-hidden="true"/>Account connected</> : connecting ? 'Connecting…' : 'Connect account'}</button>
        </Card>
        <Card data-bento-card="confirm" className="flex min-h-[270px] flex-col justify-between gap-4 rounded-[24px] border-[#ffffff14] bg-[#211c2e] p-6 text-white">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold tracking-[.12em] text-[#c6c0d2] uppercase">03 · Onchain receipt</span><FileCheck2 size={22} className="text-[#c7b5ff]" aria-hidden="true"/></div>
          <div><h3 className="text-[25px] font-bold leading-[1.15] tracking-[-.035em]">Confirm the booking</h3><p className="mt-3 text-[13px] leading-5 text-[#c6c0d2]">The contract records your booking after the transaction succeeds.</p></div>
          <span className="inline-flex w-fit rounded-full bg-[#ffffff0d] px-3 py-2 text-[10px] text-[#d7caff]">{status}</span>
        </Card>
        <Card data-bento-card="status" className="group rounded-[24px] border-none bg-[#6746d9] p-6 text-white sm:p-7 md:col-span-2">
          <a href="#trust" className="flex h-full min-h-[180px] items-center justify-between gap-4 sm:gap-6" aria-label="See how shared booking status works">
            <div className="min-w-0 max-w-[370px]"><span className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[.12em] text-[#e6dcff] uppercase"><BadgeCheck size={16} aria-hidden="true"/>04 · Shared availability</span><h3 className="mt-5 text-[26px] font-bold leading-[1.1] tracking-[-.035em] sm:text-[30px]">See shared status</h3><p className="mt-3 text-sm leading-6 text-[#eee7ff]">The home shows Rented for other visitors until the booking period ends.</p></div>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#6746d9] sm:size-14"><ArrowUpRight size={26} aria-hidden="true"/></span>
          </a>
        </Card>
      </div>
    </div>
  </section>;
}
export default AboutBento;
