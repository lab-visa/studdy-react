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
      <main style={{ paddingTop: '72px' }}>
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
