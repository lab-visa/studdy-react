export const subjects = [
  {
    id:'school', label:'School', word:'SCHOOL', accent:'#EF55B6',
    prompt:'Explain photosynthesis visually',
    desc:'Biology, chemistry, maths and physics explained with live whiteboard diagrams.',
    outcomes:['Step-by-step visual explanation','Voice + whiteboard together','Ask follow-ups until it clicks'],
  },
  {
    id:'science', label:'Science', word:'SCIENCE', accent:'#8C79E0',
    prompt:'Why does a volcano erupt?',
    desc:'Scientific processes made visible — diagrams drawn live as the concept is explained.',
    outcomes:['Real whiteboard diagrams','Cross-curriculum coverage','Any grade level'],
  },
  {
    id:'english', label:'English & Writing', word:'ENGLISH', accent:'#25A8F4',
    prompt:'Improve this English answer',
    desc:'Grammar, essay structure and writing improvement with specific, actionable feedback.',
    outcomes:['Line-by-line feedback','Essay structure guidance','Comprehension support'],
  },
  {
    id:'coding', label:'Coding & Engineering', word:'CODING', accent:'#C765C7',
    prompt:'Debug this Python code',
    desc:'Code walkthroughs, debugging and engineering concepts explained visually.',
    outcomes:['Any programming language','Error explanations','Concept to working code'],
  },
  {
    id:'exams', label:'Exam & Homework', word:'EXAMS', accent:'#EF55B6',
    prompt:'Help me revise for my exam',
    desc:'Revision, practice questions and concept summaries tailored to your exam.',
    outcomes:['Practice questions generated','Concept summaries','Exam technique coaching'],
  },
  {
    id:'work', label:'Work & Documents', word:'WORK', accent:'#25A8F4',
    prompt:'Build me an Excel commission formula',
    desc:'Excel formulas, business writing and document summarisation for professionals.',
    outcomes:['Formula walkthroughs','Email and report improvement','Document analysis'],
  },
];

export type DemoTab = 'school' | 'college' | 'work';

export interface DemoQuestion {
  id: string;
  q: string;
  tab: DemoTab;
  videoLabel: string;
}

export const DEMO_QUESTIONS: DemoQuestion[] = [
  { id:'photosynthesis', q:'Explain photosynthesis visually',      tab:'school',  videoLabel:'Biology — Photosynthesis explanation' },
  { id:'english',        q:'Improve this English answer',           tab:'school',  videoLabel:'English — Answer improvement' },
  { id:'python',         q:'Debug this Python code',                tab:'college', videoLabel:'Coding — Python debugging walkthrough' },
  { id:'engineering',    q:'Explain this engineering concept',      tab:'college', videoLabel:'Engineering — Concept explained' },
  { id:'excel',          q:'Build an Excel commission formula',     tab:'work',    videoLabel:'Excel — Commission formula walkthrough' },
  { id:'email',          q:'Improve this professional email',       tab:'work',    videoLabel:'Writing — Email improvement' },
];
