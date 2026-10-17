/**
 * Animated phone showing an EXAMPLE partner dashboard: sales drop in one by
 * one, the month's total counts up and the bonus bar fills. Clearly labelled
 * as an example underneath; no names, no real data. Reduced-motion users see
 * the finished state.
 */
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

const FEED = [
  { plan: 'Yearly', amt: 2500, city: 'Pune' },
  { plan: 'Quarterly', amt: 700, city: 'Thane' },
  { plan: 'Yearly', amt: 2500, city: 'Delhi' },
  { plan: 'Yearly', amt: 2500, city: 'Kochi' },
  { plan: 'Quarterly', amt: 700, city: 'Jaipur' },
  { plan: 'Yearly', amt: 2500, city: 'Indore' },
];
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function useCountUp(target: number) {
  const [v, setV] = useState(target);
  useEffect(() => {
    const from = v;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      setV(Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}

export default function EarningsPhone() {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(reduced ? FEED.length : 1);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setN(x => (x >= FEED.length ? 1 : x + 1)), n >= FEED.length ? 3200 : 1700);
    return () => clearTimeout(t);
  }, [n, reduced]);

  const shown = FEED.slice(0, n);
  const total = useCountUp(shown.reduce((s, x) => s + x.amt, 0));
  const sales = shown.length + 3; // pretend 3 earlier sales this month
  const last = shown[shown.length - 1];

  return (
    <div className="relative mx-auto" style={{ width: 270 }}>
      {/* floating toast */}
      <div key={n} className="ep-toast absolute -right-10 sm:-right-24 top-24 z-20 bg-white rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5"
        style={{ boxShadow: '0 16px 40px rgba(20,10,60,.25)' }}>
        <span className="w-8 h-8 rounded-xl flex items-center justify-center text-[16px]" style={{ background: 'rgba(34,197,94,.12)' }}>🎉</span>
        <div>
          <div className="text-[11px] font-bold" style={{ color: '#6B6575' }}>New sale · {last.plan}</div>
          <div className="text-[15px] font-black" style={{ color: '#16a34a' }}>+{inr(last.amt)}</div>
        </div>
      </div>

      <div className="relative rounded-[42px] p-2.5" style={{ background: '#0d0b16', boxShadow: '0 40px 80px rgba(10,5,40,.45), inset 0 0 0 2px #2a2640' }}>
        <div className="absolute left-1/2 -translate-x-1/2 top-3.5 w-20 h-5 rounded-full z-10" style={{ background: '#0d0b16' }} />
        <div className="rounded-[34px] overflow-hidden" style={{ background: '#F8F7FC', height: 520 }}>
          <div className="pt-10 px-4 pb-4 text-white" style={{ background: 'linear-gradient(135deg,#EF55B6,#8C79E0 60%,#25A8F4)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-black text-[15px]">studdy <span className="font-bold opacity-80 text-[11px]">Partner</span></span>
              <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5">This month</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">You've earned</div>
            <div className="font-black text-[32px] leading-none mb-1 tabular-nums">{inr(total)}</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold opacity-90"><TrendingUp size={12} /> {sales} sales · paid on the 10th</div>
          </div>
          <div className="px-3.5 py-3">
            <div className="bg-white rounded-2xl p-3 mb-3" style={{ border: '1px solid #EDE9F4' }}>
              <div className="flex justify-between text-[10.5px] font-bold mb-1.5" style={{ color: '#6B6575' }}>
                <span>Bonus progress</span><span style={{ color: '#15131F' }}>{Math.min(sales, 10)}/10 → +₹5,000</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#EDE9F4' }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, sales * 10)}%`, background: 'linear-gradient(90deg,#EF55B6,#25A8F4)' }} />
              </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider mb-2 px-1" style={{ color: '#6B6575' }}>Latest sales</div>
            <div className="space-y-2">
              {[...shown].reverse().slice(0, 5).map((s, i) => (
                <div key={`${n}-${i}`} className={`bg-white rounded-xl px-3 py-2.5 flex items-center justify-between ${i === 0 ? 'ep-in' : ''}`} style={{ border: '1px solid #EDE9F4' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white"
                      style={{ background: s.plan === 'Yearly' ? '#8C79E0' : '#25A8F4' }}>{s.plan[0]}</span>
                    <div>
                      <div className="text-[12px] font-bold" style={{ color: '#15131F' }}>{s.plan} plan</div>
                      <div className="text-[10px]" style={{ color: '#6B6575' }}>{s.city} · just now</div>
                    </div>
                  </div>
                  <span className="text-[12.5px] font-black" style={{ color: '#16a34a' }}>+{inr(s.amt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-[11.5px] mt-4 opacity-70">Example dashboard. What you earn depends on your sales.</p>
      <style>{`
        @keyframes ep-in { from { opacity: 0; transform: translateY(-10px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes ep-toast { 0% { opacity: 0; transform: translateY(12px) scale(.9) } 12%, 80% { opacity: 1; transform: none } 100% { opacity: 0; transform: translateY(-8px) } }
        .ep-in { animation: ep-in .45s cubic-bezier(.2,.9,.3,1.2) both }
        .ep-toast { animation: ep-toast 1.7s ease both }
        @media (prefers-reduced-motion: reduce) { .ep-in, .ep-toast { animation: none } }
      `}</style>
    </div>
  );
}
