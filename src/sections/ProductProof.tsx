import { useState } from 'react';
import SectionHeading from '../components/SectionHeading';
import LazyVideo from '../components/LazyVideo';
import Modal from '../components/Modal';
import { track } from '../utils/analytics';

export default function ProductProof() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section id="proof" className="py-24 px-6">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <SectionHeading
              eyebrow="Product proof"
              heading="Not another chatbot. A tutor that shows its work."
              sub="Watch Studdy explain one question visually, respond to follow-ups and adapt the explanation."
            />
            <button
              className="gbtn"
              onClick={() => { track('full_demo_open'); setModalOpen(true); }}
            >
              Watch the full learning session
            </button>
          </div>

          <LazyVideo
            label="30-sec Product Proof Video"
            meta="Replace with real screen recording — whiteboard + voice only"
            className="w-full min-h-[340px]"
            aspectRatio="16/9"
          />
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="p-8">
          <h3 className="font-black text-[22px] mb-4">Complete Learning Session</h3>
          <LazyVideo
            label="Full Demo — 90-100 sec"
            meta="Replace with complete product recording"
            className="w-full min-h-[320px]"
            aspectRatio="16/9"
          />
        </div>
      </Modal>
    </section>
  );
}
