export const subjects = [
  { id:'maths', label:'School Maths', word:'MATHS', icon:'📐', accent:'#EF55B6', question:'Explain fractions visually', benefits:['Step-by-step whiteboard','Voice + visual','Unlimited follow-ups'] },
  { id:'science', label:'Science', word:'SCIENCE', icon:'🔬', accent:'#8C79E0', question:'Why do volcanoes erupt?', benefits:['Diagram explanations','Real whiteboard drawing','Any science topic'] },
  { id:'english', label:'English & Writing', word:'ENGLISH', icon:'📖', accent:'#25A8F4', question:'Help me improve this essay', benefits:['Grammar with examples','Writing structure','Comprehension support'] },
  { id:'coding', label:'Coding', word:'CODING', icon:'💻', accent:'#C765C7', question:'Debug this Python code', benefits:['Code walkthroughs','Error explanations','Concept to code'] },
  { id:'engineering', label:'Engineering', word:'ENGINEERING', icon:'⚙️', accent:'#8C79E0', question:'Explain this circuit diagram', benefits:['Visual diagrams','Formula derivations','College-level depth'] },
  { id:'homework', label:'Homework & Exams', word:'EXAMS', icon:'🎯', accent:'#EF55B6', question:'Help me revise for my exam', benefits:['Practice questions','Concept summaries','Exam technique'] },
  { id:'excel', label:'Excel & Work', word:'EXCEL', icon:'📊', accent:'#25A8F4', question:'Build me a VLOOKUP formula', benefits:['Formula walkthroughs','Data explanations','Professional tasks'] },
  { id:'documents', label:'Documents & Reports', word:'REPORTS', icon:'📄', accent:'#C765C7', question:'Summarise this document', benefits:['Document analysis','Report improvement','Professional writing'] },
];

export type DemoStep = { q: string; steps: string[]; fill: number };

export const demoTabs: Record<string, DemoStep[]> = {
  school: [
    { q:'Explain how photosynthesis works', steps:['Photosynthesis is how plants make food using sunlight.','Formula: CO₂ + H₂O + light → glucose + O₂','This happens in the chloroplasts, using chlorophyll.','Glucose fuels the plant\'s growth and energy needs.'], fill:70 },
    { q:'Help me improve this English answer', steps:['Start with a clear topic sentence.','Support with evidence from the text.','Explain what that evidence shows.','Link back to the question directly.'], fill:60 },
    { q:'Solve this algebra question step by step', steps:['Identify what you\'re solving for.','Collect like terms on one side.','Isolate the variable using inverse operations.','Check by substituting the answer back in.'], fill:75 },
  ],
  college: [
    { q:'Explain this engineering concept', steps:['Break the system into smaller components.','Identify the inputs and outputs of each part.','Apply the relevant equations or laws.','Check units and dimensions throughout.'], fill:65 },
    { q:'Debug this Python code', steps:['Read the error message — it tells you exactly where it failed.','Check variable types at the point of failure.','Add print statements to trace the value flow.','Test the fix with edge cases too.'], fill:55 },
    { q:'Help me understand this economics graph', steps:['Identify what the axes represent.','Find the equilibrium — where the curves meet.','Note what happens when one variable shifts.','Connect it back to the real-world concept.'], fill:60 },
  ],
  work: [
    { q:'Build an Excel formula', steps:['State what you want the formula to return.','Identify the right function: VLOOKUP, SUMIF, INDEX-MATCH.','Build it step by step in the formula bar.','Test with a known value before applying to all rows.'], fill:70 },
    { q:'Improve this business email', steps:['Open with the main point — not context.','Use one clear ask per email.','Remove filler phrases that add length without meaning.','Close with a specific next step.'], fill:65 },
    { q:'Summarise this document', steps:['Identify the document\'s main purpose.','Extract the three to five key conclusions.','Note any actions or decisions required.','Summarise in plain language for the target reader.'], fill:60 },
  ],
};
