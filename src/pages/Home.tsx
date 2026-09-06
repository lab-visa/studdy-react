import Header from '../sections/Header';
import Hero from '../sections/Hero';
import EmotionalHook from '../sections/EmotionalHook';
import ProductProof from '../sections/ProductProof';
import AskStuddy from '../sections/AskStuddy';
import ScrollStory from '../sections/ScrollStory';
import HowItWorks from '../sections/HowItWorks';
import Comparison from '../sections/Comparison';
import Testimonials from '../sections/Testimonials';
import Pricing from '../sections/Pricing';
import FAQ from '../sections/FAQ';
import FinalCTA from '../sections/FinalCTA';
import Footer from '../sections/Footer';

export default function Home() {
  return (
    <>
      <Header />
      {/* FIX (Sep 2026): pb-24 (mobile only — matches Header's own md:hidden
       * breakpoint for the sticky bottom CTA bar) reserves the ~96px that
       * bar actually occupies (measured 75.5px + breathing room), so
       * content scrolled to the bottom of the page — confirmed via mobile
       * audit: the Pricing section's own Yearly-plan button — never
       * renders partially hidden behind it. Matching padding added to
       * Footer.tsx too, since Footer is the page's real final scroll
       * destination, outside this <main>. */}
      <main className="pb-24 md:pb-0" style={{ paddingTop: '72px' }}>
        <Hero />
        <EmotionalHook />
        <ProductProof />
        <AskStuddy />
        <ScrollStory />
        <HowItWorks />
        <Comparison />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
