import FAQItem from '../components/FAQItem';
import SectionHeading from '../components/SectionHeading';

/* 12 questions grouped into 3 themed sections of 4, per Vish's request
 * (Aug 2026) — easier to scan than one long list. */
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
  return (
    <section id="faq" className="py-24 px-6" style={{ background: 'var(--dim)' }}>
      <div className="max-w-[780px] mx-auto">
        <SectionHeading eyebrow="Questions" heading="Before you start." />
        <div className="flex flex-col gap-10">
          {FAQ_GROUPS.map(group => (
            <div key={group.heading}>
              <div
                className="text-[11px] font-black uppercase tracking-wide mb-1"
                style={{ color: 'var(--g2)', letterSpacing: '0.08em' }}
              >
                {group.heading}
              </div>
              {group.items.map((f, i) => <FAQItem key={i} {...f} />)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
