# Studdy Lab — Complete React/Vite/TypeScript Website

## Tech Stack
- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4 (via @tailwindcss/vite)
- GSAP + ScrollTrigger (cinematic scroll story)
- Framer Motion (FAQ accordion, modals)
- React Router v7

## Pages
| Route | Page |
|-------|------|
| `/` | Main landing page (all 16 sections) |
| `/dashboard` | User dashboard mock-up |
| `/checkout` | Checkout placeholder (no real payment yet) |
| `/checkout-success` | Redirects to dashboard |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |
| `/refund` | Refund Policy |
| `/cancellation` | Cancellation Policy |
| `/contact` | Contact & Support |

## Local development

```bash
npm install
npm run dev
```
Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Push to GitHub
2. Import to vercel.com
3. Framework: Vite (auto-detected)
4. No environment variables needed for Phase 1

vercel.json handles client-side routing rewrites.

## Replacing placeholders

### Videos
Every `<LazyVideo>` component accepts:
```tsx
<LazyVideo
  src="/videos/hero.mp4"
  webm="/videos/hero.webm"
  poster="/posters/hero.jpg"
  autoplay loop
/>
```
Drop files into `public/videos/` and `public/posters/` then update the props.

### Payments
In `src/pages/Checkout.tsx`, replace the placeholder with your Stripe Elements or Razorpay embed.
After payment success, redirect to `/checkout-success` which auto-redirects to `/dashboard`.

### WhatsApp number
Search for `wa.me/441234567890` and replace with your real number.

### Analytics
`src/utils/analytics.ts` has all event hooks. Uncomment and configure GA4/Meta Pixel when ready.

## Architecture

```
src/
  components/       Reusable UI: CTAButton, FAQItem, LazyVideo, Modal, PricingCard, SectionHeading
  sections/         Page sections: Header, Hero, EmotionalHook, ProductProof, AskStuddy,
                    ScrollStory, SubjectSelector, HowItWorks, Comparison, Testimonials,
                    Pricing, FAQ, FinalCTA, Footer
  pages/            Route pages: Home, Dashboard, Checkout, CheckoutSuccess, Legal
  data/             Content data: subjects.ts, pricing.ts
  utils/            analytics.ts
public/
  videos/           Drop MP4/WebM files here
  images/           Static images
  posters/          Video poster frames
```
