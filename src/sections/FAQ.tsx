import { useState } from 'react';
import FAQItem from '../components/FAQItem';
import SectionHeading from '../components/SectionHeading';
import { useMarket } from '../context/MarketContext';

/* 12 questions grouped into 3 tabs, shown one tab at a time — like
 * unischooly.com's FAQ section — instead of one long stacked list that
 * makes the page keep scrolling. */
const FAQ_GROUPS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: 'Who it\'s for',
    items: [
      { q:'Who can use Studdy Lab?', a:'Anyone who needs clear explanations — primary and secondary school students, college and engineering students, professionals using Excel or writing documents, and anyone who gets stuck and needs something explained visually.' },
      { q:'Is this only for schoolchildren?', a:'Not at all. Studdy is designed for school students, college learners, coders, engineers and working professionals. The interface adapts to your topic and depth of question.' },
      { q:'Can adults and professionals use it?', a:'Absolutely. Many users are professionals who use Studdy for Excel, writing improvement, document analysis and concept explanations at work.' },
      { q:'Which subjects and tasks are supported?', a:'Maths, Science, English, History, Geography, coding in any language, engineering, economics, Excel formulas, business writing, document summarisation and exam preparation, among others.' },
    ],
  },
  {
    heading: 'How it works',
    items: [
      { q:'Can I upload homework, screenshots or documents?', a:'Yes. You can type, speak or upload an image, screenshot or document and Studdy will explain it.' },
      { q:'Can it help with coding or engineering?', a:'Yes. Studdy walks through code line by line, explains errors, and covers engineering concepts and diagrams.' },
      { q:'Which device works best?', a:'This website works on any device. The full whiteboard and voice tutor is best on a laptop or tablet with an 11-inch or larger screen.' },
      { q:'Can I use it on multiple devices?', a:'Your account can be accessed on different devices using your login details.' },
    ],
  },
  {
    heading: 'Billing & trust',
    items: [
      { q:'When will I be charged?', a:`Nothing is charged during the ${7}-day trial. We will message you before the trial ends to remind you. You decide whether to continue.` },
      { q:'How do I cancel?', a:'Send a message on WhatsApp before your next billing date. No calls, no forms. Done in under a minute.' },
      { q:'Can I cancel before the trial ends?', a:'Yes, at any time during the trial with no charge.' },
      { q:'How is my payment information handled?', a:'Payments are processed securely. We do not store card details directly. See our Privacy Policy for full details.' },
    ],
  },
];

/* India (Oct 2026): pay first, Quarterly/Yearly, 7-day full refund —
 * no free trial. Shown instead of FAQ_GROUPS when the visitor is in India. */
const INDIA_FAQ_GROUPS: typeof FAQ_GROUPS = [
  {
    heading: "Who it's for",
    items: [
      { q:'Which boards does Studdy Lab support?', a:'All of them: CBSE, ICSE/ISC, IB, IGCSE and every State Board, from Class 1 to Class 12. Ask any question from your textbook, NCERT exercise, worksheet or past paper.' },
      { q:'Does it help with JEE, NEET and other entrance exams?', a:'Yes. Studdy explains concepts and solves tough problems step by step for JEE Main & Advanced, NEET, CUET, BITSAT, state CETs, CLAT, NDA, Olympiads and more, and re-explains as many times as you need.' },
      { q:'Is it useful after school?', a:'Very. College and PG students use it for semester subjects and assignments (B.Tech, MBBS, B.Com, MBA and more), and working professionals use it to learn Excel, coding, data and new skills.' },
      { q:'Does it replace tuition?', a:"It covers what tuition can't: the doubt at 11 pm, the step you missed in class, the question you were too shy to ask. Many families use it alongside school and tuition." },
    ],
  },
  {
    heading: 'How it works',
    items: [
      { q:'How do I ask a question?', a:'Type it, speak it, or upload a photo of the question from your book or notebook. Studdy explains it on a live whiteboard, and you can interrupt anytime with a follow-up.' },
      { q:'Which device do I need?', a:'Studdy works best on a laptop or a tablet (11-inch screen or larger). This website works on any phone, but the full whiteboard tutor needs a bigger screen.' },
      { q:'How do I get my login after paying?', a:'Right after payment you land on your personal dashboard with your login details and simple steps to start. Bookmark that page or save it on WhatsApp: it is your permanent link. Lost it? Message us and we will resend it.' },
      { q:'Can the whole family use it?', a:"Your plan is for one learner. Need it for more than one child? Message us on WhatsApp and we'll help." },
    ],
  },
  {
    heading: 'Payment & refund',
    items: [
      { q:'How much does it cost?', a:'₹7,999 for 3 months, or ₹14,999 for a full year (just ₹1,250 a month). Prices include GST. No hidden charges, no auto-debit.' },
      { q:"What if I don't like it?", a:"Ask for a refund within 7 days of paying and we'll refund you in full. Just message us on WhatsApp or email support@studdyai.org." },
      { q:'Is there a free trial?', a:'Instead of a trial, we give you a 7-day full refund, so you get the complete product from day one with no risk.' },
      { q:'What happens when my plan ends?', a:"Nothing is charged automatically. We'll remind you before your plan ends, and you decide whether to renew." },
    ],
  },
];

export default function FAQ() {
  const [tab, setTab] = useState(0);
  const { isIndia } = useMarket();
  const groups = isIndia ? INDIA_FAQ_GROUPS : FAQ_GROUPS;

  return (
    <section id="faq" className="py-24 px-6" style={{ background: 'var(--dim)' }}>
      <div className="max-w-[780px] mx-auto">
        <SectionHeading eyebrow="Questions" heading="Before you start." center />

        {/* Tabs */}
        <div className="flex gap-2 justify-center flex-wrap mb-8">
          {groups.map((group, i) => (
            <button
              key={group.heading}
              onClick={() => setTab(i)}
              className="px-5 py-2.5 rounded-full text-[13px] font-bold transition-all"
              style={{
                background: tab === i ? 'var(--ink)' : '#fff',
                color:      tab === i ? '#fff' : 'var(--soft)',
                border: `1.5px solid ${tab === i ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {group.heading}
            </button>
          ))}
        </div>

        {/* Only the active group's questions are rendered — no giant
         * stacked list, no extra page scroll. */}
        <div className="bg-white rounded-3xl px-6 sm:px-8" style={{ border: '1.5px solid var(--border)' }}>
          {groups[tab].items.map((f, i) => <FAQItem key={f.q} {...f} last={i === groups[tab].items.length - 1} />)}
        </div>
      </div>
    </section>
  );
}
