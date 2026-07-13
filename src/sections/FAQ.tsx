import FAQItem from '../components/FAQItem';
import SectionHeading from '../components/SectionHeading';

const faqs = [
  { q:'Who can use Studdy Lab?', a:'Anyone who needs clear explanations — from primary school students and teenagers to college learners, professionals and working adults. If you ever get stuck on something and need it explained, Studdy is for you.' },
  { q:'Is it only for schoolchildren?', a:'Not at all. Studdy helps school students, college and engineering students, people learning to code, professionals working with Excel or reports, and anyone who needs something explained clearly and visually.' },
  { q:'Which subjects and work tasks are supported?', a:'Maths, Science, English, History, Geography, coding in any language, engineering concepts, economics, Excel formulas, business writing, document summarisation and exam preparation, among others.' },
  { q:'Can I upload homework, screenshots and documents?', a:'Yes. In the full tutor you can type, speak or upload an image of your homework, a screenshot, a document or a graph and Studdy will explain it.' },
  { q:'Can it help with coding or engineering?', a:'Yes. Studdy can walk through code line by line, debug errors, explain programming concepts and work through engineering problems and diagrams step by step.' },
  { q:'When will I be charged?', a:'Nothing is charged today. Your trial starts free. We will send you a WhatsApp message before your trial ends to remind you. You decide whether to continue.' },
  { q:'How do I cancel?', a:'Send "Cancel" on WhatsApp before your next billing date. No calls, no forms, no waiting. Done in under a minute.' },
  { q:'Which device works best?', a:'The website works on any device. For the full whiteboard and voice tutor, a laptop or tablet with an 11-inch screen or larger gives the best experience.' },
  { q:'Is my information private?', a:'Yes. We do not sell your data. Sessions are private and not shared with third parties. You can read our full Privacy Policy in the footer.' },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-[780px] mx-auto">
        <SectionHeading eyebrow="Questions" heading="Before you start." />
        {faqs.map((f, i) => <FAQItem key={i} {...f} />)}
      </div>
    </section>
  );
}
