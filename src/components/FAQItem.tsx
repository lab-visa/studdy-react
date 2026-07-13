import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props { q: string; a: string; }

export default function FAQItem({ q, a }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b py-5 cursor-pointer select-none"
      style={{ borderColor: 'var(--border)' }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex justify-between items-start gap-4">
        <span className="font-bold text-[16px] leading-snug">{q}</span>
        <span className="text-xl flex-shrink-0 transition-transform duration-300" style={{ color: 'var(--g2)', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="flex gap-3 pt-3 items-start">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-black text-white text-xs" style={{ background: 'var(--grad)' }}>A</div>
              <p className="text-[14.5px] leading-relaxed" style={{ color: 'var(--soft)' }}>{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
