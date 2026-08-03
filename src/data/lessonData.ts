/**
 * lessonData.ts — 36/36 videos mapped.
 *
 * CDN: vz-b523719a-f10.b-cdn.net  (Library 712849)
 * MP4 format: https://vz-b523719a-f10.b-cdn.net/{VIDEO_ID}/play_720p.mp4
 *
 * TO ADD OR UPDATE A VIDEO:
 *   Replace the ID string inside mp4('...') for that topic/follow-up.
 *   No component changes needed.
 *   mp4('') = unavailable → shows "Soon" badge, no player mounted.
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
  mp4Url: string;
}

export interface LessonTopic {
  id: string;
  title: string;
  descriptor: string;
  question: string;
  Icon: LucideIcon;
  mp4Url: string;
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

export const LESSON_CATEGORIES: LessonCategory[] = [

  /* ─── SCHOOL LEARNING ─── */
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
            mp4Url: mp4('92431746-ebfa-4536-beec-70052f8035fb') },
          { id: 'volcano-fu2', label: 'Can we predict when it will blow?',
            mp4Url: mp4('32b7c777-1da5-4c76-a7be-152951355b0a') },
        ],
      },
      {
        id: 'minecraft-maths',
        title: 'Minecraft Maths',
        descriptor: 'Learn geometry through building',
        question: 'Can you show me the maths in Minecraft?',
        Icon: Blocks,
        mp4Url: mp4('3be211b2-0ecd-4cfc-9620-1438d992af70'),
        followUps: [
          { id: 'mc-fu1', label: 'How do we calculate surface area for a roof?',
            mp4Url: mp4('1eeb5f29-a670-4131-a15c-f9a816c1850c') },
          { id: 'mc-fu2', label: 'What happens if we double the size of the base?',
            mp4Url: mp4('ca44de8c-48d7-4225-a213-8d626040568c') },
        ],
      },
      {
        id: 'story-writing',
        title: 'Story Writing',
        descriptor: 'Build stronger stories',
        question: 'How do I write a great story?',
        Icon: BookOpen,
        mp4Url: mp4('703f6da3-ad29-49ed-ae80-4adcc1eda850'),
        followUps: [
          { id: 'story-fu1', label: 'What happens if the climax is too early?',
            mp4Url: mp4('a4f414a5-a652-47d4-8489-0eac81db79d4') },
          { id: 'story-fu2', label: 'How do I write a hook for the beginning?',
            mp4Url: mp4('eab3409a-4b94-4df1-b11f-da35048a0a88') },
        ],
      },
      {
        id: 'black-holes',
        title: 'Black Holes',
        descriptor: 'Explore space visually',
        question: 'What is a black hole?',
        Icon: Telescope,
        mp4Url: mp4('affa3325-0e2c-4767-85c3-d1b517622123'),
        followUps: [
          { id: 'bh-fu1', label: 'What happens if I fall in?',
            mp4Url: mp4('e474b6cb-30f2-421e-bafd-e3d5c01f9cfd') },
          { id: 'bh-fu2', label: 'Is our sun going to become one?',
            mp4Url: mp4('68f94feb-b8a0-4800-af92-d8a6f3d325e9') },
        ],
      },
    ],
  },

  /* ─── COLLEGE CONCEPTS ─── */
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
        mp4Url: mp4('def86a6c-39ba-49cc-bb79-5f138855cd6e'),
        followUps: [
          { id: 'flight-fu1', label: "Why don't airplanes fall out of the sky?",
            mp4Url: mp4('aee31fae-c289-4d47-94bf-c198b243f47b') },
          { id: 'flight-fu2', label: "Why can't helicopters fly the same way?",
            mp4Url: mp4('1fd5d0c6-60dc-40ff-a53f-97692632ae81') },
        ],
      },
      {
        id: 'ai-learning',
        title: 'Artificial Intelligence',
        descriptor: 'See how machines learn',
        question: 'How does Artificial Intelligence actually learn?',
        Icon: Brain,
        mp4Url: mp4('3a496c5c-2cbf-49ac-94c0-53ea3354a72e'),
        followUps: [
          { id: 'ai-fu1', label: "What's the difference between AI and Machine Learning?",
            mp4Url: mp4('75be1ffb-74fb-4c6a-8e30-27f637ed8376') },
          { id: 'ai-fu2', label: 'Can AI think like humans?',
            mp4Url: mp4('c69e431d-7dc7-4e41-b151-841537b37687') },
        ],
      },
      {
        id: 'supply-demand',
        title: 'Supply & Demand',
        descriptor: 'Learn pricing through real examples',
        question: 'Can you explain supply and demand with a real-world example?',
        Icon: TrendingUp,
        mp4Url: mp4('1f9a5a15-f4ec-4405-9fb8-6f0d84c74653'),
        followUps: [
          { id: 'sd-fu1', label: 'Why do prices increase when demand goes up?',
            mp4Url: mp4('5919d296-217a-496c-a873-936d50493e00') },
          { id: 'sd-fu2', label: 'Can you show this using iPhones or concert tickets?',
            mp4Url: mp4('c943e719-9b7c-4ded-bd34-395d7c839351') },
        ],
      },
      {
        id: 'dna',
        title: 'DNA & Genetics',
        descriptor: 'Understand inherited traits',
        question: 'How does DNA decide what we look like?',
        Icon: Dna,
        mp4Url: mp4('a0f67acf-7eec-47a7-9a87-edf557800a4d'),
        followUps: [
          { id: 'dna-fu1', label: 'Can we change our DNA?',
            mp4Url: mp4('299c1d95-d593-40bf-b663-4adaf3a12150') },
          { id: 'dna-fu2', label: 'Why do I look like my parents but not exactly?',
            mp4Url: mp4('61083239-5d8a-4772-a345-f811d4a25a4d') },
        ],
      },
    ],
  },

  /* ─── WORK & NEW SKILLS ─── */
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
        mp4Url: mp4('c8e0cf27-5872-4a24-af9a-5e95f884665c'),
        followUps: [
          { id: 'mf-fu1', label: 'Why do most visitors never become customers?',
            mp4Url: mp4('8f213996-e0c3-435d-ae08-154e0c3a704b') },
          { id: 'mf-fu2', label: 'Can you show me how companies like Nike or Apple use marketing funnels?',
            mp4Url: mp4('217acc5b-d9d5-4b7a-960d-245b7a7883e2') },
        ],
      },
      {
        id: 'pivot-tables',
        title: 'Excel Pivot Tables',
        descriptor: 'Summarise data quickly',
        question: 'Can you teach me Pivot Tables in Excel with a real example?',
        Icon: Table,
        mp4Url: mp4('2b35de89-0f11-4cbd-9a34-388c54dfcde1'),
        followUps: [
          { id: 'pt-fu1', label: 'When should I use a Pivot Table instead of formulas?',
            mp4Url: mp4('23da26c3-3808-4a48-b503-93e1b45025df') },
          { id: 'pt-fu2', label: 'Can you show me how to summarise sales data in one click?',
            mp4Url: mp4('662f6293-c356-4e4a-b75b-6c3f7e1ccf96') },
        ],
      },
      {
        id: 'presentations',
        title: 'Presentation Skills',
        descriptor: 'Speak with more confidence',
        question: 'How can I speak confidently during presentations?',
        Icon: Presentation,
        mp4Url: mp4('ff2a1c3e-dacb-4503-9e61-b50cea9e32af'),
        followUps: [
          { id: 'pres-fu1', label: 'What should I do if I forget what to say?',
            mp4Url: mp4('2fb4571c-38a2-4e50-9fd5-ce0fae72cd1e') },
          { id: 'pres-fu2', label: 'How do I stop feeling nervous before presenting?',
            mp4Url: mp4('a8539e7c-10bf-49d4-86a8-3e4112dc6dbf') },
        ],
      },
      {
        id: 'compound-interest',
        title: 'Compound Interest',
        descriptor: 'See how money compounds',
        question: 'Can you explain compound interest with a real investment example?',
        Icon: PiggyBank,
        mp4Url: mp4('8784a6c0-63c0-42ad-98d0-9b74b77df0ca'),
        followUps: [
          { id: 'ci-fu1', label: 'Why should I start investing early?',
            mp4Url: mp4('5d5ea3c1-997f-49d0-aa6a-5ff04733b161') },
          { id: 'ci-fu2', label: 'How much difference can $50 a month make over 20 years?',
            mp4Url: mp4('2f514c32-de86-4d03-a8c6-537d28e32bfb') },
        ],
      },
    ],
  },
];
