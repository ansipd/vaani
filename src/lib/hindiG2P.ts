/**
 * Deterministic Offline Devanagari & Hindi G2P + Bilingual Script Segmentation
 * Maps Hindi (Devanagari) directly to Kokoro-82M v1.0 IPA phoneme vocabulary,
 * and cleans eSpeak-NG Hindi IPA output so all tokens stay inside Kokoro's vocab.
 */

export interface LexiconEntry {
  id: string;
  word: string;
  replacement: string;
  lang: 'en' | 'hi' | 'both';
  isIpa: boolean;
  updatedAt: number;
}

export interface ScriptSegment {
  text: string;
  lang: 'en' | 'hi';
  voiceOverride?: string;
}

// Official Kokoro-82M v1.0 tokenizer character set (114 symbols)
const KOKORO_VALID_PHONEME_CHARS = new Set(
  `;:,.!?¡¿—…"«»“” ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ`.split(
    ''
  )
);

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

const INDEPENDENT_VOWELS: Record<string, string> = {
  'अ': 'ə',
  'आ': 'ɑː',
  'इ': 'ɪ',
  'ई': 'iː',
  'उ': 'ʊ',
  'ऊ': 'uː',
  'ऋ': 'ɾɪ',
  'ए': 'eː',
  'ऐ': 'ɛː',
  'ओ': 'oː',
  'औ': 'ɔː',
  'ऑ': 'ɔː',
  'ऍ': 'ɛ',
};

const VOWEL_MATRAS: Record<string, string> = {
  'ा': 'ɑː',
  'ि': 'ɪ',
  'ी': 'iː',
  'ु': 'ʊ',
  'ू': 'uː',
  'ृ': 'ɾɪ',
  'े': 'eː',
  'ै': 'ɛː',
  'ो': 'oː',
  'ौ': 'ɔː',
  'ॉ': 'ɔː',
  'ॅ': 'ɛ',
};

const CONSONANTS: Record<string, string> = {
  'क': 'k',
  'ख': 'kʰ',
  'ग': 'ɡ',
  'घ': 'ɡʱ',
  'ङ': 'ŋ',
  'च': 'tʃ',
  'छ': 'tʃʰ',
  'ज': 'dʒ',
  'झ': 'dʒʱ',
  'ञ': 'ɲ',
  'ट': 'ʈ',
  'ठ': 'ʈʰ',
  'ड': 'ɖ',
  'ढ': 'ɖʱ',
  'ण': 'ɳ',
  'त': 't',
  'थ': 'tʰ',
  'द': 'd',
  'ध': 'dʱ',
  'न': 'n',
  'प': 'p',
  'फ': 'pʰ',
  'ब': 'b',
  'भ': 'bʱ',
  'म': 'm',
  'य': 'j',
  'र': 'ɾ',
  'ल': 'l',
  'ळ': 'ɭ',
  'व': 'ʋ',
  'श': 'ʃ',
  'ष': 'ʂ',
  'स': 's',
  'ह': 'ɦ',
  // Precomposed nukta forms
  'क़': 'q',
  'ख़': 'x',
  'ग़': 'ɣ',
  'ज़': 'z',
  'ड़': 'ɽ',
  'ढ़': 'ɽʱ',
  'फ़': 'f',
  'य़': 'j',
  'ऩ': 'n',
  'ऱ': 'ɾ',
};

const NUKTA_MAP: Record<string, string> = {
  'क': 'q',
  'ख': 'x',
  'ग': 'ɣ',
  'ज': 'z',
  'ड': 'ɽ',
  'ढ': 'ɽʱ',
  'फ': 'f',
};

const HINDI_DIGITS: Record<string, string> = {
  '०': 'शून्य',
  '१': 'एक',
  '२': 'दो',
  '३': 'तीन',
  '४': 'चार',
  '५': 'पाँच',
  '६': 'छह',
  '७': 'सात',
  '८': 'आठ',
  '९': 'नौ',
};

const HINDI_NUMBERS_0_99: string[] = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरेसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी',
  'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे',
];

function numberToHindiWords(num: number): string {
  if (!Number.isFinite(num) || num < 0) return String(num);
  if (num < 100) return HINDI_NUMBERS_0_99[num];
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const r = num % 100;
    return r === 0 ? `${HINDI_NUMBERS_0_99[h]} सौ` : `${HINDI_NUMBERS_0_99[h]} सौ ${numberToHindiWords(r)}`;
  }
  if (num < 100000) {
    const th = Math.floor(num / 1000);
    const r = num % 1000;
    return r === 0
      ? `${numberToHindiWords(th)} हज़ार`
      : `${numberToHindiWords(th)} हज़ार ${numberToHindiWords(r)}`;
  }
  return String(num)
    .split('')
    .map((d) => HINDI_NUMBERS_0_99[Number(d)] ?? d)
    .join(' ');
}

export function normalizeHindiNumbers(text: string): string {
  // Convert Devanagari numerals ०-९ to ASCII first
  const asciiDigits = text.replace(/[०-९]/g, (ch) => {
    const code = ch.charCodeAt(0) - 0x0966;
    return String(code);
  });

  return asciiDigits
    .replace(/₹\s?(\d+)/g, (_, n) => `${numberToHindiWords(Number(n))} रुपये`)
    .replace(/\b(\d{1,5})\b/g, (match, n) => {
      const val = Number(n);
      if (val >= 0 && val <= 99999) {
        return numberToHindiWords(val);
      }
      return match
        .split('')
        .map((d) => HINDI_DIGITS[String.fromCharCode(0x0966 + Number(d))] ?? d)
        .join(' ');
    });
}

/**
 * Convert a single Devanagari word to Kokoro-compatible IPA using authentic Hindi
 * phonological rules including word-final and medial schwa syncope.
 */
function devanagariWordToIPA(rawWord: string): string {
  // Normalize common conjunct shortcuts first
  const word = rawWord
    .replace(/क्ष/g, 'क्‌ष')
    .replace(/त्र/g, 'त्‌र')
    .replace(/ज्ञ/g, 'ग्‌य')
    .replace(/श्र/g, 'श्‌र')
    .replace(/\u200C|\u200D/g, '');

  const chars = Array.from(word);
  interface Token {
    type: 'C' | 'V' | 'OTHER';
    ipa: string;
    explicitVowel: boolean;
    hasVirama: boolean;
    nasal: boolean;
  }

  const tokens: Token[] = [];
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (ch === '्' || ch === '़') {
      i++;
      continue;
    }

    if (INDEPENDENT_VOWELS[ch]) {
      let nasal = false;
      if (next === 'ँ' || next === 'ं') {
        nasal = true;
        i++;
      }
      tokens.push({
        type: 'V',
        ipa: INDEPENDENT_VOWELS[ch],
        explicitVowel: true,
        hasVirama: false,
        nasal,
      });
      i++;
      continue;
    }

    if (CONSONANTS[ch]) {
      let ipa = CONSONANTS[ch];
      if (next === '़' && NUKTA_MAP[ch]) {
        ipa = NUKTA_MAP[ch];
        i++;
      }
      const afterCons = chars[i + 1];
      if (afterCons === '्') {
        tokens.push({
          type: 'C',
          ipa,
          explicitVowel: false,
          hasVirama: true,
          nasal: false,
        });
        i += 2;
        continue;
      }
      if (afterCons && VOWEL_MATRAS[afterCons]) {
        let nasal = false;
        let step = 2;
        if (chars[i + 2] === 'ँ' || chars[i + 2] === 'ं') {
          nasal = true;
          step = 3;
        }
        tokens.push({
          type: 'C',
          ipa: ipa + VOWEL_MATRAS[afterCons],
          explicitVowel: true,
          hasVirama: false,
          nasal,
        });
        i += step;
        continue;
      }
      let nasal = false;
      let step = 1;
      if (afterCons === 'ँ' || afterCons === 'ं') {
        nasal = true;
        step = 2;
      } else if (afterCons === 'ः') {
        ipa += 'əɦ';
        step = 2;
      }
      tokens.push({
        type: 'C',
        ipa,
        explicitVowel: false,
        hasVirama: false,
        nasal,
      });
      i += step;
      continue;
    }

    if (ch === 'ं' || ch === 'ँ') {
      if (tokens.length > 0) {
        tokens[tokens.length - 1].nasal = true;
      }
      i++;
      continue;
    }

    if (ch === '।') {
      tokens.push({ type: 'OTHER', ipa: '.', explicitVowel: false, hasVirama: false, nasal: false });
      i++;
      continue;
    }

    if (ch === '॥') {
      tokens.push({ type: 'OTHER', ipa: '.', explicitVowel: false, hasVirama: false, nasal: false });
      i++;
      continue;
    }

    tokens.push({ type: 'OTHER', ipa: ch, explicitVowel: false, hasVirama: false, nasal: false });
    i++;
  }

  // Apply Hindi inherent schwa rules (schwa retention vs deletion)
  let out = '';
  const consAndVowelTokens = tokens.filter((t) => t.type !== 'OTHER');
  const totalSyllables = consAndVowelTokens.length;

  for (let idx = 0; idx < tokens.length; idx++) {
    const t = tokens[idx];
    if (t.type !== 'C') {
      out += t.ipa;
      if (t.nasal) out += 'n';
      continue;
    }

    if (t.hasVirama || t.explicitVowel) {
      out += t.ipa;
      if (t.nasal) {
        const nextTok = tokens[idx + 1];
        out += homorganicNasal(nextTok?.ipa);
      }
      continue;
    }

    // Consonant with implicit schwa
    const prev = tokens[idx - 1];
    const next = tokens[idx + 1];
    const isLast = !next || next.type === 'OTHER';
    const precededByCluster = prev?.type === 'C' && prev.hasVirama;

    let keepSchwa = true;

    // 1. Word-final schwa deletion (unless single syllable or preceded by consonant cluster)
    if (isLast && totalSyllables > 1 && !precededByCluster) {
      keepSchwa = false;
    }

    // 2. Medial schwa deletion in VC_CV context when followed by consonant + explicit full vowel
    if (
      !isLast &&
      idx > 0 &&
      !precededByCluster &&
      next?.type === 'C' &&
      next.explicitVowel &&
      prev &&
      (prev.explicitVowel || prev.type === 'V' || (!prev.hasVirama && idx === 1))
    ) {
      keepSchwa = false;
    }

    out += t.ipa;
    if (keepSchwa) {
      out += 'ə';
    }
    if (t.nasal) {
      out += homorganicNasal(next?.ipa);
    }
  }

  return out;
}

function homorganicNasal(nextIpa?: string): string {
  if (!nextIpa) return 'n';
  if (/^[pb]/.test(nextIpa)) return 'm';
  if (/^[kɡq]/.test(nextIpa)) return 'ŋ';
  if (/^[ʈɖ]/.test(nextIpa)) return 'ɳ';
  if (/^(tʃ|dʒ)/.test(nextIpa)) return 'ɲ';
  return 'n';
}

/**
 * Clean & sanitize any IPA string (either from eSpeak-NG 'hi' or our Devanagari G2P)
 * so every character is strictly valid in Kokoro-82M v1.0's tokenizer vocabulary.
 */
export function sanitizeKokoroPhonemes(ipa: string): string {
  const normalized = ipa
    .replace(/।/g, '.')
    .replace(/॥/g, '.')
    .replace(/t͡ʃ|t͜ʃ|c/g, 'ʧ')
    .replace(/d͡ʒ|d͜ʒ/g, 'ʤ')
    .replace(/tʃ/g, 'ʧ')
    .replace(/dʒ/g, 'ʤ')
    .replace(/ɡ/g, 'ɡ')
    .replace(/g/g, 'ɡ')
    .replace(/aː/g, 'ɑː')
    .replace(/a/g, 'ɑ')
    .replace(/r/g, 'ɾ')
    .replace(/ʋ/g, 'ʋ')
    .replace(/v/g, 'ʋ')
    .replace(/y/g, 'j')
    .replace(/̃/g, '') // combining tilde is not a standalone Kokoro token
    .replace(/̪/g, '') // dental diacritic stripped
    .replace(/̤/g, 'ʱ')
    .replace(/͡|͜/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let result = '';
  for (const ch of Array.from(normalized)) {
    if (KOKORO_VALID_PHONEME_CHARS.has(ch)) {
      result += ch;
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Full offline Devanagari text -> Kokoro IPA phonemes
 */
export function hindiToKokoroIPA(text: string): string {
  const normalized = normalizeHindiNumbers(text)
    .replace(/।/g, '. ')
    .replace(/॥/g, '. ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();

  const parts = normalized.split(/(\s+|[.,!?;:—\-()"]+)/g).filter(Boolean);
  const converted = parts.map((part) => {
    if (/^\s+$/.test(part) || /^[.,!?;:—\-()"]+$/.test(part)) {
      return part;
    }
    if (DEVANAGARI_REGEX.test(part)) {
      return devanagariWordToIPA(part);
    }
    return part;
  });

  return sanitizeKokoroPhonemes(converted.join(''));
}

export function containsDevanagari(text: string): boolean {
  return DEVANAGARI_REGEX.test(text);
}

/**
 * Apply user-defined offline pronunciation lexicon before synthesis.
 */
export function applyPronunciationLexicon(
  text: string,
  lexicon: LexiconEntry[],
  lang: 'en' | 'hi'
): string {
  if (!lexicon.length) return text;
  let output = text;
  for (const entry of lexicon) {
    if (!entry.word.trim() || !entry.replacement.trim()) continue;
    if (entry.lang !== 'both' && entry.lang !== lang) continue;
    if (entry.isIpa) continue; // IPA overrides handled directly if needed
    const escaped = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = containsDevanagari(entry.word)
      ? new RegExp(escaped, 'g')
      : new RegExp(`\\b${escaped}\\b`, 'gi');
    output = output.replace(regex, entry.replacement);
  }
  return output;
}

/**
 * Parse multi-speaker dialogue tags like "[hf_alpha]: नमस्ते" or auto-segment mixed
 * English & Devanagari Hindi sentences for seamless bilingual synthesis.
 */
export function segmentTextForSynthesis(
  rawText: string,
  mode: 'auto' | 'en' | 'hi',
  defaultVoice: string,
  secondaryHindiVoice: string
): ScriptSegment[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Check for explicit speaker dialogue lines: "[voice_id]: text"
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const hasDialogueTags = lines.some((l) => /^\[([a-z]{2}_[a-z]+)\]\s*:/i.test(l));

  if (hasDialogueTags) {
    const segments: ScriptSegment[] = [];
    for (const line of lines) {
      const m = line.match(/^\[([a-z]{2}_[a-z]+)\]\s*:\s*(.+)$/i);
      if (m) {
        const voiceId = m[1].toLowerCase();
        const body = m[2].trim();
        const lang: 'en' | 'hi' =
          voiceId.startsWith('h') || containsDevanagari(body) ? 'hi' : 'en';
        segments.push({ text: body, lang, voiceOverride: voiceId });
      } else {
        const isHi = mode === 'hi' || (mode === 'auto' && containsDevanagari(line));
        segments.push({
          text: line,
          lang: isHi ? 'hi' : 'en',
          voiceOverride: isHi ? secondaryHindiVoice : defaultVoice,
        });
      }
    }
    return segments;
  }

  // Split into sentence chunks preserving English & Devanagari purna viram (।)
  const rawSentences = trimmed
    .split(/(?<=[.!?।॥])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (mode === 'en') {
    return rawSentences.map((text) => ({ text, lang: 'en' }));
  }

  if (mode === 'hi') {
    return rawSentences.map((text) => ({ text, lang: 'hi' }));
  }

  // Auto Bilingual mode: classify each sentence (or split mixed sentence runs)
  const segments: ScriptSegment[] = [];
  for (const sentence of rawSentences) {
    const hasDev = containsDevanagari(sentence);
    const hasLatin = /[A-Za-z]{2,}/.test(sentence);

    if (hasDev && !hasLatin) {
      segments.push({ text: sentence, lang: 'hi' });
    } else if (!hasDev) {
      segments.push({ text: sentence, lang: 'en' });
    } else {
      // Mixed English + Hindi inside the same sentence: group contiguous runs by script
      const words = sentence.split(/\s+/);
      let currentLang: 'en' | 'hi' = containsDevanagari(words[0]) ? 'hi' : 'en';
      let buffer: string[] = [];

      for (const word of words) {
        const wordLang: 'en' | 'hi' = containsDevanagari(word)
          ? 'hi'
          : /[A-Za-z]/.test(word)
            ? 'en'
            : currentLang;
        if (wordLang !== currentLang && buffer.length > 0) {
          segments.push({ text: buffer.join(' '), lang: currentLang });
          buffer = [word];
          currentLang = wordLang;
        } else {
          buffer.push(word);
        }
      }
      if (buffer.length > 0) {
        segments.push({ text: buffer.join(' '), lang: currentLang });
      }
    }
  }

  return segments;
}
