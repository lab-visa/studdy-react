import { useState } from 'react';
import FAQItem from '../components/FAQItem';
import SectionHeading from '../components/SectionHeading';

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

export default function FAQ() {
  const [tab, setTab] = useState(0);

  return (
    <section id="faq" className="py-24 px-6" style={{ background: 'var(--dim)' }}>
      <div className="max-w-[780px] mx-auto">
        <SectionHeading eyebrow="Questions" heading="Before you start." center />

        {/* Tabs */}
        <div className="flex gap-2 justify-center flex-wrap mb-8">
          {FAQ_GROUPS.map((group, i) => (
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
          {FAQ_GROUPS[tab].items.map((f, i) => <FAQItem key={f.q} {...f} last={i === FAQ_GROUPS[tab].items.length - 1} />)}
        </div>
      </div>
    </section>
  );
}
