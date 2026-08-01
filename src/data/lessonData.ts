/**
 * lessonData.ts — complete 12-topic lesson catalogue.
 *
 * CDN: vz-b523719a-f10.b-cdn.net  (Library 712849)
 * MP4 format: https://vz-b523719a-f10.b-cdn.net/{VIDEO_ID}/play_720p.mp4
 *
 * TO ADD A VIDEO:
 *   Replace the empty string '' with the direct MP4 URL.
 *   No component changes needed.
 */

import type { LucideIcon } from 'lucide-react';
import {
  FlaskConical, GraduationCap, Briefcase,
  Mountain, Blocks, BookOpen, Telescope,
  Plane, Brain, TrendingUp, Dna,
  Megaphone, Table, Presentation, PiggyBank,
} from 'lucide-react';

const CDN = 'https://vz-b523719a-f10.b-cdn.net';
const mp4 = (id: string) => id ? `${CDN}/${id}/play_720p.mp4` : '';

export interface FollowUp {
  id: string;
  label: string;
  mp4Url: string;   // direct Bunny MP4 — empty string = not yet available
}

export interface LessonTopic {
  id: string;
  title: string;        // short card title
  descriptor: string;   // one-line card description
  question: string;     // full question typed into the input
  Icon: LucideIcon;
  mp4Url: string;       // direct Bunny MP4 — empty string = not yet available
  followUps: [FollowUp, FollowUp];
}

export interface CategoryContext {
  label: string;
  heading: string;
  description: string;
  bullets: [string, string, string];
  cta: string;
}

export interface LessonCategory {
  id: string;
  label: string;
  Icon: LucideIcon;
  context: CategoryContext;
  topics: [LessonTopic, LessonTopic, LessonTopic, LessonTopic];
}

/* ══════════════════════════════════════════════════════════════════════
   LESSON CATALOGUE
   ══════════════════════════════════════════════════════════════════════ */

export const LESSON_CATEGORIES: LessonCategory[] = [

  /* ── SCHOOL LEARNING ─────────────────────────────────────────────── */
  {
    id: 'school',
    label: 'School Learning',
    Icon: FlaskConical,
    context: {
      label: 'School Learning',
      heading: 'Understand difficult subjects visually.',
      description: 'Maths, science and English explained through live visual lessons.',
      bullets: [
        'Step-by-step visual explanations',
        'Voice and whiteboard together',
        'Ask follow-ups until it clicks',
      ],
      cta: 'Try School Learning',
    },
    topics: [
      {
        id: 'volcano',
        title: 'Volcanoes',
        descriptor: 'See how eruptions happen',
        question: 'Show me how a volcano works?',
        Icon: Mountain,
        mp4Url: mp4('0126c5eb-ae5b-4ac7-8842-f8314e38242e'),
        followUps: [
          { id: 'volcano-fu1', label: 'Why is lava so hot?',
            mp4Url: mp4('8df2b099-8037-4efd-b349-3ff3ee9925fc') },
          { id: 'volcano-fu2', label: 'Can we predict when it will blow?',
            mp4Url: mp4('69a9d0d0-944e-4436-9f09-af868f3b1134') },
        ],
      },
      {
        id: 'minecraft-maths',
        title: 'Minecraft Maths',
        descriptor: 'Learn geometry through building',
        question: 'Can you show me the maths in Minecraft?',
        Icon: Blocks,
        mp4Url: mp4(''),
        followUps: [
          { id: 'mc-fu1', label: 'How do we calculate surface area for a roof?', mp4Url: mp4('') },
          { id: 'mc-fu2', label: 'What happens if we double the size of the base?', mp4Url: mp4('') },
        ],
      },
      {
        id: 'story-writing',
        title: 'Story Writing',
        descriptor: 'Build stronger stories',
        question: 'How do I write a great story?',
        Icon: BookOpen,
        mp4Url: mp4(''),
        followUps: [
          { id: 'story-fu1', label: 'What happens if the climax is too early?', mp4Url: mp4('') },
          { id: 'story-fu2', label: 'How do I write a hook for the beginning?', mp4Url: mp4('') },
        ],
      },
      {
        id: 'black-holes',
        title: 'Black Holes',
        descriptor: 'Explore space visually',
        question: 'What is a black hole?',
        Icon: Telescope,
        mp4Url: mp4(''),
        followUps: [
          { id: 'bh-fu1', label: 'What happens if I fall in?', mp4Url: mp4('') },
          { id: 'bh-fu2', label: 'Is our sun going to become one?', mp4Url: mp4('') },
        ],
      },
    ],
  },

  /* ── COLLEGE CONCEPTS ────────────────────────────────────────────── */
  {
    id: 'college',
    label: 'College Concepts',
    Icon: GraduationCap,
    context: {
      label: 'College Concepts',
      heading: 'Make complex concepts easier to understand.',
      description: 'See difficult ideas broken down through examples, diagrams and follow-up questions.',
      bullets: [
        'Visual explanations for complex topics',
        'Real-world examples',
        'Learn at your own pace',
      ],
      cta: 'Try College Learning',
    },
    topics: [
      {
        id: 'flight',
        title: 'Flight',
        descriptor: 'Understand lift and airflow',
        question: 'How do airplanes stay in the air?',
        Icon: Plane,
        mp4Url: mp4(''),
        followUps: [
          { id: 'flight-fu1', label: "Why don't airplanes fall out of the sky?", mp4Url: mp4('') },
          { id: 'flight-fu2', label: "Why can't helicopters fly the same way?", mp4Url: mp4('') },
        ],
      },
      {
        id: 'ai-learning',
        title: 'Artificial Intelligence',
        descriptor: 'See how machines learn',
        question: 'How does Artificial Intelligence actually learn?',
        Icon: Brain,
        mp4Url: mp4(''),
        followUps: [
          { id: 'ai-fu1', label: "What's the difference between AI and Machine Learning?", mp4Url: mp4('') },
          { id: 'ai-fu2', label: 'Can AI think like humans?', mp4Url: mp4('') },
        ],
      },
      {
        id: 'supply-demand',
        title: 'Supply & Demand',
        descriptor: 'Learn pricing through real examples',
        question: 'Can you explain supply and demand with a real-world example?',
        Icon: TrendingUp,
        mp4Url: mp4(''),
        followUps: [
          { id: 'sd-fu1', label: 'Why do prices increase when demand goes up?', mp4Url: mp4('') },
          { id: 'sd-fu2', label: 'Can you show this using iPhones or concert tickets?', mp4Url: mp4('') },
        ],
      },
      {
        id: 'dna',
        title: 'DNA & Genetics',
        descriptor: 'Understand inherited traits',
        question: 'How does DNA decide what we look like?',
        Icon: Dna,
        mp4Url: mp4(''),
        followUps: [
          { id: 'dna-fu1', label: 'Can we change our DNA?', mp4Url: mp4('') },
          { id: 'dna-fu2', label: 'Why do I look like my parents but not exactly?', mp4Url: mp4('') },
        ],
      },
    ],
  },

  /* ── WORK & NEW SKILLS ───────────────────────────────────────────── */
  {
    id: 'work',
    label: 'Work & New Skills',
    Icon: Briefcase,
    context: {
      label: 'Work & New Skills',
      heading: 'Learn practical skills through real examples.',
      description: 'Understand tools, communication and business concepts without long courses.',
      bullets: [
        'Practical workplace examples',
        'Step-by-step skill building',
        'Ask questions when something is unclear',
      ],
      cta: 'Try Work & New Skills',
    },
    topics: [
      {
        id: 'marketing-funnel',
        title: 'Marketing Funnels',
        descriptor: 'Follow a customer journey',
        question: 'Can you explain a marketing funnel with a real business example?',
        Icon: Megaphone,
        mp4Url: mp4(''),
        followUps: [
          { id: 'mf-fu1', label: 'Why do most visitors never become customers?', mp4Url: mp4('') },
          { id: 'mf-fu2', label: 'Can you show me how companies like Nike or Apple use marketing funnels?', mp4Url: mp4('') },
        ],
      },
      {
        id: 'pivot-tables',
        title: 'Excel Pivot Tables',
        descriptor: 'Summarise data quickly',
        question: 'Can you teach me Pivot Tables in Excel with a real example?',
        Icon: Table,
        mp4Url: mp4(''),
        followUps: [
          { id: 'pt-fu1', label: 'When should I use a Pivot Table instead of formulas?', mp4Url: mp4('') },
          { id: 'pt-fu2', label: 'Can you show me how to summarise sales data in one click?', mp4Url: mp4('') },
        ],
      },
      {
        id: 'presentations',
        title: 'Presentation Skills',
        descriptor: 'Speak with more confidence',
        question: 'How can I speak confidently during presentations?',
        Icon: Presentation,
        mp4Url: mp4(''),
        followUps: [
          { id: 'pres-fu1', label: 'What should I do if I forget what to say?', mp4Url: mp4('') },
          { id: 'pres-fu2', label: 'How do I stop feeling nervous before presenting?', mp4Url: mp4('') },
        ],
      },
      {
        id: 'compound-interest',
        title: 'Compound Interest',
        descriptor: 'See how money compounds',
        question: 'Can you explain compound interest with a real investment example?',
        Icon: PiggyBank,
        mp4Url: mp4(''),
        followUps: [
          { id: 'ci-fu1', label: 'Why should I start investing early?', mp4Url: mp4('') },
          { id: 'ci-fu2', label: 'How much difference can $50 a month make over 20 years?', mp4Url: mp4('') },
        ],
      },
    ],
  },
];
