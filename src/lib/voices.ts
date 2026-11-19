export type VoiceLangCode = 'hi' | 'en-us' | 'en-gb';

export interface KokoroVoice {
  id: string;
  name: string;
  nativeLabel?: string;
  language: VoiceLangCode;
  languageLabel: string;
  gender: 'Female' | 'Male';
  grade: string;
  accent: string;
  styleNotes: string;
}

export const KOKORO_VOICES: readonly KokoroVoice[] = [
  // Official Kokoro-82M v1.0 Hindi Voices
  {
    id: 'hf_alpha',
    name: 'Alpha',
    nativeLabel: 'अल्फ़ा',
    language: 'hi',
    languageLabel: 'Hindi',
    gender: 'Female',
    grade: 'C',
    accent: 'Standard Hindi (IN)',
    styleNotes: 'Clear, balanced Devanagari articulation for news & assistants',
  },
  {
    id: 'hf_beta',
    name: 'Beta',
    nativeLabel: 'बीटा',
    language: 'hi',
    languageLabel: 'Hindi',
    gender: 'Female',
    grade: 'C',
    accent: 'Standard Hindi (IN)',
    styleNotes: 'Warm conversational cadence suited for audiobooks & stories',
  },
  {
    id: 'hm_omega',
    name: 'Omega',
    nativeLabel: 'ओमेगा',
    language: 'hi',
    languageLabel: 'Hindi',
    gender: 'Male',
    grade: 'C',
    accent: 'Standard Hindi (IN)',
    styleNotes: 'Deep, steady broadcast tone for long-form Hindi reading',
  },
  {
    id: 'hm_psi',
    name: 'Psi',
    nativeLabel: 'साई',
    language: 'hi',
    languageLabel: 'Hindi',
    gender: 'Male',
    grade: 'C',
    accent: 'Standard Hindi (IN)',
    styleNotes: 'Crisp, neutral male voice for navigation & UI prompts',
  },

  // Top Kokoro-82M v1.0 American English Voices
  {
    id: 'af_heart',
    name: 'Heart',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Female',
    grade: 'A',
    accent: 'American English',
    styleNotes: 'Flagship Kokoro voice — expressive, natural prosody',
  },
  {
    id: 'af_bella',
    name: 'Bella',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Female',
    grade: 'A-',
    accent: 'American English',
    styleNotes: 'Bright, dynamic phrasing for narration & podcasts',
  },
  {
    id: 'af_nicole',
    name: 'Nicole',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Female',
    grade: 'B-',
    accent: 'American English',
    styleNotes: 'Intimate, studio-close delivery ideal for calm reading',
  },
  {
    id: 'af_sarah',
    name: 'Sarah',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Female',
    grade: 'C+',
    accent: 'American English',
    styleNotes: 'Clean documentary tone with steady pacing',
  },
  {
    id: 'af_aoede',
    name: 'Aoede',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Female',
    grade: 'C+',
    accent: 'American English',
    styleNotes: 'Articulate assistant timbre with clear consonant attacks',
  },
  {
    id: 'af_nova',
    name: 'Nova',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Female',
    grade: 'C',
    accent: 'American English',
    styleNotes: 'Modern, energetic voice for notifications & tutorials',
  },
  {
    id: 'af_sky',
    name: 'Sky',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Female',
    grade: 'C-',
    accent: 'American English',
    styleNotes: 'Light, friendly conversational register',
  },
  {
    id: 'am_michael',
    name: 'Michael',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Male',
    grade: 'C+',
    accent: 'American English',
    styleNotes: 'Grounded, resonant narration voice for books & articles',
  },
  {
    id: 'am_fenrir',
    name: 'Fenrir',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Male',
    grade: 'C+',
    accent: 'American English',
    styleNotes: 'Authoritative, full-bodied tone with crisp lows',
  },
  {
    id: 'am_puck',
    name: 'Puck',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Male',
    grade: 'C+',
    accent: 'American English',
    styleNotes: 'Lively, expressive cadence for dialogue & explainers',
  },
  {
    id: 'am_adam',
    name: 'Adam',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Male',
    grade: 'F+',
    accent: 'American English',
    styleNotes: 'Classic deep voiceover timbre',
  },
  {
    id: 'am_echo',
    name: 'Echo',
    language: 'en-us',
    languageLabel: 'English (US)',
    gender: 'Male',
    grade: 'D',
    accent: 'American English',
    styleNotes: 'Measured, smooth mid-range baritone',
  },

  // British English Voices
  {
    id: 'bf_emma',
    name: 'Emma',
    language: 'en-gb',
    languageLabel: 'English (UK)',
    gender: 'Female',
    grade: 'B-',
    accent: 'British English',
    styleNotes: 'Refined RP English diction for literature & briefings',
  },
  {
    id: 'bf_isabella',
    name: 'Isabella',
    language: 'en-gb',
    languageLabel: 'English (UK)',
    gender: 'Female',
    grade: 'C',
    accent: 'British English',
    styleNotes: 'Warm British cadence with smooth phrasing',
  },
  {
    id: 'bm_george',
    name: 'George',
    language: 'en-gb',
    languageLabel: 'English (UK)',
    gender: 'Male',
    grade: 'C',
    accent: 'British English',
    styleNotes: 'Classic British narrator with crisp enunciation',
  },
  {
    id: 'bm_fable',
    name: 'Fable',
    language: 'en-gb',
    languageLabel: 'English (UK)',
    gender: 'Male',
    grade: 'C',
    accent: 'British English',
    styleNotes: 'Expressive storytelling voice with subtle warmth',
  },
  {
    id: 'bm_lewis',
    name: 'Lewis',
    language: 'en-gb',
    languageLabel: 'English (UK)',
    gender: 'Male',
    grade: 'D+',
    accent: 'British English',
    styleNotes: 'Steady, understated British male voice',
  },
];

export function getVoiceById(id: string): KokoroVoice {
  return KOKORO_VOICES.find((v) => v.id === id) ?? KOKORO_VOICES[0];
}

export type ModelDtype = 'q8' | 'q4' | 'fp16' | 'fp32';

export interface ModelPreset {
  dtype: ModelDtype;
  label: string;
  approxSize: string;
  recommendedFor: string;
  notes: string;
}

export const MODEL_PRESETS: readonly ModelPreset[] = [
  {
    dtype: 'q8',
    label: 'INT8 Quantized (q8)',
    approxSize: '92 MB',
    recommendedFor: 'Android & Mobile CPU/WASM',
    notes: 'Best balance of studio voice clarity, compact download, and fast on-device latency.',
  },
  {
    dtype: 'q4',
    label: 'INT4 Compact (q4)',
    approxSize: '154 MB',
    recommendedFor: 'Low-RAM Devices',
    notes: 'Mixed 4-bit weight quantization for memory-constrained environments.',
  },
  {
    dtype: 'fp16',
    label: 'Float16 GPU (fp16)',
    approxSize: '163 MB',
    recommendedFor: 'WebGPU / Flagship Android GPU',
    notes: 'Half-precision weights tuned for hardware GPU acceleration.',
  },
  {
    dtype: 'fp32',
    label: 'Float32 Reference (fp32)',
    approxSize: '326 MB',
    recommendedFor: 'Desktop Studio / Maximum Fidelity',
    notes: 'Full single-precision weights matching reference Kokoro-82M v1.0 output.',
  },
];

export interface SampleScript {
  id: string;
  label: string;
  language: 'hi' | 'en' | 'bilingual';
  recommendedVoice: string;
  secondaryHindiVoice?: string;
  text: string;
}

export const SAMPLE_SCRIPTS: readonly SampleScript[] = [
  {
    id: 'hi-welcome',
    label: 'Hindi Greeting',
    language: 'hi',
    recommendedVoice: 'hf_alpha',
    text: 'नमस्ते! वाणी ऑफ़लाइन टेक्स्ट टू स्पीच में आपका स्वागत है। यह कोकोरो मॉडल बिना इंटरनेट के आपके फ़ोन पर स्पष्ट और स्वाभाविक हिन्दी आवाज़ बनाता है।',
  },
  {
    id: 'hi-story',
    label: 'Hindi Broadcast',
    language: 'hi',
    recommendedVoice: 'hm_omega',
    text: 'आज सुबह मौसम साफ़ रहेगा और हवा हल्की चलेगी। यात्रियों से अनुरोध है कि अपनी यात्रा से पहले समय सारिणी की जांच कर लें।',
  },
  {
    id: 'en-studio',
    label: 'English Narration',
    language: 'en',
    recommendedVoice: 'af_heart',
    text: 'Welcome to Vaani. Kokoro-82M runs completely offline on your device, turning plain text into crisp twenty-four kilohertz studio speech with zero cloud dependency.',
  },
  {
    id: 'bilingual-mix',
    label: 'Bilingual EN + HI',
    language: 'bilingual',
    recommendedVoice: 'af_heart',
    secondaryHindiVoice: 'hf_alpha',
    text: 'Good morning! आज की मुख्य खबर यह है कि अब ऑन-डिवाइस एआई मॉडल पूरी तरह ऑफ़लाइन काम कर सकते हैं। You can switch effortlessly between English and Hindi in a single audio track.',
  },
  {
    id: 'dialogue-script',
    label: 'Multi-Speaker Dialogue',
    language: 'bilingual',
    recommendedVoice: 'hf_alpha',
    secondaryHindiVoice: 'hm_omega',
    text: '[hf_alpha]: नमस्ते! क्या आज की ट्रेन समय पर है?\n[hm_omega]: जी हाँ, राजधानी एक्सप्रेस प्लेटफॉर्म संख्या चार पर दस मिनट में पहुँच रही है।\n[af_heart]: Thank you for traveling with us. Please keep your boarding pass ready.',
  },
];

export const DEVANAGARI_QUICK_CHIPS: readonly { label: string; text: string }[] = [
  { label: 'नमस्ते', text: 'नमस्ते ' },
  { label: 'धन्यवाद', text: 'धन्यवाद ' },
  { label: 'शुभ प्रभात', text: 'शुभ प्रभात ' },
  { label: 'स्वागत है', text: 'स्वागत है ' },
  { label: '। (Purna Viram)', text: '। ' },
];
