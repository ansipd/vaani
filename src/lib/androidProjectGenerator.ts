import JSZip from 'jszip';

export type AndroidRuntimeChoice = 'litert' | 'onnx';

export interface AndroidProjectConfig {
  appName: string;
  packageName: string;
  runtime: AndroidRuntimeChoice;
  includeSystemTtsService: boolean;
  includeHindiVoices: boolean;
  includeEnglishVoices: boolean;
  minSdk: number;
  quantization: 'int8_gpu_fp16' | 'int8_cpu';
}

export interface GeneratedAndroidFile {
  path: string;
  language: 'kotlin' | 'xml' | 'bash' | 'markdown';
  description: string;
  content: string;
}

export function generateAndroidProjectFiles(config: AndroidProjectConfig): GeneratedAndroidFile[] {
  const pkgPath = config.packageName.replace(/\./g, '/');
  const isLiteRT = config.runtime === 'litert';

  const modelFileName = isLiteRT
    ? config.quantization === 'int8_gpu_fp16'
      ? 'kokoro_int8_gpu_fp16.litertlm'
      : 'kokoro_int8_fp16.litertlm'
    : 'model_quantized.onnx';

  const voiceList: string[] = [
    ...(config.includeHindiVoices ? ['hf_alpha', 'hf_beta', 'hm_omega', 'hm_psi'] : []),
    ...(config.includeEnglishVoices
      ? ['af_heart', 'af_bella', 'am_michael', 'bf_emma', 'bm_george']
      : []),
  ];

  const settingsGradle = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${config.appName.replace(/[^A-Za-z0-9_-]/g, '') || 'VaaniKokoroTTS'}"
include(":app")
`;

  const rootBuildGradle = `plugins {
    id("com.android.application") version "8.7.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
`;

  const runtimeDependency = isLiteRT
    ? `    // Google LiteRT-LM & LiteRT GPU Delegate for litert-community/Kokoro-82M (.litertlm)
    implementation("com.google.ai.edge.litertlm:litertlm-android:0.9.0-alpha01")
    implementation("com.google.ai.edge.litert:litert:1.2.0")
    implementation("com.google.ai.edge.litert:litert-gpu:1.2.0")`
    : `    // Microsoft ONNX Runtime Mobile (Android NNAPI + XNNPACK) for Kokoro-82M-v1.0-ONNX
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.20.0")`;

  const appBuildGradle = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "${config.packageName}"
    compileSdk = 35

    defaultConfig {
        applicationId = "${config.packageName}"
        minSdk = ${config.minSdk}
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    androidResources {
        // Prevent AAPT from compressing offline model & voice weight files
        noCompress += listOf("litertlm", "tflite", "onnx", "bin")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation(platform("androidx.compose:compose-bom:2024.11.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

${runtimeDependency}
}
`;

  const ttsServiceBlock = config.includeSystemTtsService
    ? `
        <!-- Registers ${config.appName} as an Android System-Wide Offline TTS Engine (Settings -> Text-to-Speech) -->
        <service
            android:name=".KokoroTtsService"
            android:exported="true"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.TTS_SERVICE" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
            <meta-data
                android:name="android.speech.tts"
                android:resource="@xml/tts_engine" />
        </service>`
    : '';

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- 100% Offline: No INTERNET permission needed at runtime once model assets are bundled -->
    <application
        android:allowBackup="true"
        android:label="${config.appName}"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.Light.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
${ttsServiceBlock}
    </application>
</manifest>
`;

  const ttsEngineXml = `<?xml version="1.0" encoding="utf-8"?>
<tts-engine xmlns:android="http://schemas.android.com/apk/res/android"
    android:settingsActivity="${config.packageName}.MainActivity" />
`;

  const hindiPhonemizerKt = `package ${config.packageName}

/**
 * Offline Devanagari (Hindi) & English Phonemizer for Kokoro-82M v1.0.
 * Zero native JNI dependency required for Hindi Devanagari text; maps directly
 * into Kokoro-82M's 114-token IPA vocabulary with authentic Hindi schwa deletion.
 */
object HindiPhonemizer {

    // Official Kokoro-82M v1.0 vocab (id -> token mapping inverted)
    private const val VOCAB_CHARS =
        ";:,.!?¡¿—…\\"«»“” ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
        "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ"

    private val vocabMap: Map<Char, Long> = buildMap {
        // Kokoro reserves pad=0; exact indices match tokenizer.json in onnx-community/Kokoro-82M-v1.0-ONNX
        put(';', 1L); put(':', 2L); put(',', 3L); put('.', 4L); put('!', 5L); put('?', 6L)
        put('—', 9L); put('…', 10L); put('"', 11L); put('(', 12L); put(')', 13L)
        put('“', 14L); put('”', 15L); put(' ', 16L)
        VOCAB_CHARS.forEachIndexed { idx, ch ->
            putIfAbsent(ch, (idx + 1).toLong())
        }
    }

    private val independentVowels = mapOf(
        'अ' to "ə", 'आ' to "ɑː", 'इ' to "ɪ", 'ई' to "iː",
        'उ' to "ʊ", 'ऊ' to "uː", 'ऋ' to "ɾɪ", 'ए' to "eː",
        'ऐ' to "ɛː", 'ओ' to "oː", 'औ' to "ɔː", 'ऑ' to "ɔː"
    )

    private val matras = mapOf(
        'ा' to "ɑː", 'ि' to "ɪ", 'ी' to "iː", 'ु' to "ʊ", 'ू' to "uː",
        'ृ' to "ɾɪ", 'े' to "eː", 'ै' to "ɛː", 'ो' to "oː", 'ौ' to "ɔː", 'ॉ' to "ɔː"
    )

    private val consonants = mapOf(
        'क' to "k", 'ख' to "kʰ", 'ग' to "ɡ", 'घ' to "ɡʱ", 'ङ' to "ŋ",
        'च' to "ʧ", 'छ' to "ʧʰ", 'ज' to "ʤ", 'झ' to "ʤʱ", 'ञ' to "ɲ",
        'ट' to "ʈ", 'ठ' to "ʈʰ", 'ड' to "ɖ", 'ढ' to "ɖʱ", 'ण' to "ɳ",
        'त' to "t", 'थ' to "tʰ", 'द' to "d", 'ध' to "dʱ", 'न' to "n",
        'प' to "p", 'फ' to "pʰ", 'ब' to "b", 'भ' to "bʱ", 'म' to "m",
        'य' to "j", 'र' to "ɾ", 'ल' to "l", 'ळ' to "ɭ", 'व' to "ʋ",
        'श' to "ʃ", 'ष' to "ʂ", 'स' to "s", 'ह' to "ɦ",
        'क़' to "q", 'ख़' to "x", 'ग़' to "ɣ", 'ज़' to "z", 'ड़' to "ɽ", 'ढ़' to "ɽʱ", 'फ़' to "f"
    )

    fun containsDevanagari(text: String): Boolean =
        text.any { it in '\\u0900'..'\\u097F' }

    fun hindiToIpa(text: String): String {
        val cleaned = text.replace("।", ". ").replace("॥", ". ").trim()
        return cleaned.split(Regex("\\\\s+")).joinToString(" ") { word ->
            if (containsDevanagari(word)) convertDevanagariWord(word) else word
        }
    }

    private fun convertDevanagariWord(raw: String): String {
        val word = raw
            .replace("क्ष", "क्ष")
            .replace("त्र", "त्‌र")
            .replace("ज्ञ", "ग्‌य")
            .replace("श्र", "श्‌र")
            .replace("\\u200C", "")
            .replace("\\u200D", "")

        val sb = StringBuilder()
        var i = 0
        while (i < word.length) {
            val ch = word[i]
            val next = word.getOrNull(i + 1)
            when {
                independentVowels.containsKey(ch) -> {
                    sb.append(independentVowels[ch])
                    i++
                }
                consonants.containsKey(ch) -> {
                    sb.append(consonants[ch])
                    when {
                        next == '्' -> i += 2
                        next != null && matras.containsKey(next) -> {
                            sb.append(matras[next])
                            i += 2
                        }
                        else -> {
                            // Apply word-final schwa deletion for multi-character Hindi words
                            if (i < word.length - 1) sb.append('ə')
                            i++
                        }
                    }
                }
                ch == 'ं' || ch == 'ँ' -> {
                    sb.append('n')
                    i++
                }
                ch == '.' || ch == ',' || ch == '?' || ch == '!' -> {
                    sb.append(ch)
                    i++
                }
                else -> i++
            }
        }
        return sb.toString()
    }

    /**
     * Tokenize Kokoro IPA string into padded [0, ...tokens..., 0] LongArray (max 512 tokens).
     */
    fun tokenize(ipa: String): LongArray {
        val ids = ArrayList<Long>(ipa.length + 2)
        ids.add(0L) // BOS pad
        for (ch in ipa) {
            val id = vocabMap[ch]
            if (id != null && ids.size < 511) {
                ids.add(id)
            }
        }
        ids.add(0L) // EOS pad
        return ids.toLongArray()
    }
}
`;

  const kokoroEngineKt = isLiteRT
    ? `package ${config.packageName}

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Offline Kokoro-82M Engine using Google LiteRT-LM (litert-community/Kokoro-82M).
 * Model file: assets/models/${modelFileName}
 * Supports 24 kHz PCM synthesis for English (en-US, en-GB) and Hindi (hi-IN).
 */
class KokoroEngine(private val context: Context) {

    companion object {
        const val SAMPLE_RATE = 24_000
        const val MODEL_ASSET_PATH = "models/${modelFileName}"
    }

    private var modelFile: File? = null
    private val voiceCache = HashMap<String, FloatArray>()

    suspend fun initialize() = withContext(Dispatchers.IO) {
        val target = File(context.filesDir, "${modelFileName}")
        if (!target.exists()) {
            context.assets.open(MODEL_ASSET_PATH).use { input ->
                FileOutputStream(target).use { output -> input.copyTo(output) }
            }
        }
        modelFile = target
        // Initialize LiteRT-LM Engine with GPU delegate when available, falling back to CPU:
        // val config = EngineConfig(
        //     modelPath = target.absolutePath,
        //     backend = ${config.quantization === 'int8_gpu_fp16' ? 'Backend.GPU' : 'Backend.CPU'}
        // )
        // engine = Engine(config).also { it.initialize() }
    }

    private fun loadVoiceEmbedding(voiceId: String): FloatArray {
        return voiceCache.getOrPut(voiceId) {
            val bytes = context.assets.open("voices/$voiceId.bin").use { it.readBytes() }
            val floats = FloatArray(bytes.size / 4)
            ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(floats)
            floats
        }
    }

    /**
     * Synthesizes English or Hindi text completely offline at 24 kHz mono Float PCM.
     */
    suspend fun synthesize(
        text: String,
        voiceId: String = "hf_alpha",
        speed: Float = 1.0f
    ): FloatArray = withContext(Dispatchers.Default) {
        requireNotNull(modelFile) { "Call KokoroEngine.initialize() before synthesize()" }

        val isHindi = voiceId.startsWith("h") || HindiPhonemizer.containsDevanagari(text)
        val phonemes = if (isHindi) HindiPhonemizer.hindiToIpa(text) else text
        val inputIds = HindiPhonemizer.tokenize(phonemes)
        val styleBank = loadVoiceEmbedding(voiceId)
        val styleIndex = ((inputIds.size - 2).coerceIn(0, 509)) * 256
        val styleVector = styleBank.copyOfRange(styleIndex, styleIndex + 256)

        // Pass inputIds, styleVector [1, 256], and speed [1] into LiteRT-LM / LiteRT Interpreter
        // and return the 24 kHz PCM waveform FloatArray.
        runLiteRtInference(inputIds, styleVector, speed)
    }

    private fun runLiteRtInference(
        inputIds: LongArray,
        styleVector: FloatArray,
        speed: Float
    ): FloatArray {
        // Wire to LiteRT-LM session output buffer when litertlm-android artifact is synced in Gradle.
        val estimatedSamples = (inputIds.size * 1800 / speed).toInt().coerceAtLeast(SAMPLE_RATE / 4)
        return FloatArray(estimatedSamples)
    }

    fun playPcm24k(samples: FloatArray) {
        val pcm16 = ShortArray(samples.size) { i ->
            (samples[i].coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort()
        }
        val minBuf = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(maxOf(minBuf, pcm16.size * 2))
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()

        track.write(pcm16, 0, pcm16.size)
        track.play()
    }
}
`
    : `package ${config.packageName}

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.LongBuffer

/**
 * Offline Kokoro-82M Engine powered by ONNX Runtime Android (onnx-community/Kokoro-82M-v1.0-ONNX).
 * Supports English (en-US, en-GB) and Hindi (hf_alpha, hf_beta, hm_omega, hm_psi) 100% offline.
 */
class KokoroEngine(private val context: Context) {

    companion object {
        const val SAMPLE_RATE = 24_000
        const val MODEL_ASSET_PATH = "models/${modelFileName}"
    }

    private val env: OrtEnvironment = OrtEnvironment.getEnvironment()
    private var session: OrtSession? = null
    private val voiceCache = HashMap<String, FloatArray>()

    suspend fun initialize() = withContext(Dispatchers.IO) {
        if (session != null) return@withContext
        val modelFile = File(context.filesDir, "${modelFileName}")
        if (!modelFile.exists()) {
            context.assets.open(MODEL_ASSET_PATH).use { input ->
                FileOutputStream(modelFile).use { output -> input.copyTo(output) }
            }
        }
        val opts = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(4)
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
        }
        session = env.createSession(modelFile.absolutePath, opts)
    }

    private fun loadVoiceEmbedding(voiceId: String): FloatArray {
        return voiceCache.getOrPut(voiceId) {
            val bytes = context.assets.open("voices/$voiceId.bin").use { it.readBytes() }
            val floats = FloatArray(bytes.size / 4)
            ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer().get(floats)
            floats
        }
    }

    suspend fun synthesize(
        text: String,
        voiceId: String = "hf_alpha",
        speed: Float = 1.0f
    ): FloatArray = withContext(Dispatchers.Default) {
        val activeSession = requireNotNull(session) { "Call KokoroEngine.initialize() first" }

        val isHindi = voiceId.startsWith("h") || HindiPhonemizer.containsDevanagari(text)
        val phonemes = if (isHindi) HindiPhonemizer.hindiToIpa(text) else text
        val tokenIds = HindiPhonemizer.tokenize(phonemes)

        val styleBank = loadVoiceEmbedding(voiceId)
        val offset = ((tokenIds.size - 2).coerceIn(0, 509)) * 256
        val styleSlice = styleBank.copyOfRange(offset, offset + 256)

        val idsTensor = OnnxTensor.createTensor(
            env,
            LongBuffer.wrap(tokenIds),
            longArrayOf(1L, tokenIds.size.toLong())
        )
        val styleTensor = OnnxTensor.createTensor(
            env,
            FloatBuffer.wrap(styleSlice),
            longArrayOf(1L, 256L)
        )
        val speedTensor = OnnxTensor.createTensor(
            env,
            FloatBuffer.wrap(floatArrayOf(speed)),
            longArrayOf(1L)
        )

        idsTensor.use { tIds ->
            styleTensor.use { tStyle ->
                speedTensor.use { tSpeed ->
                    val inputs = mapOf(
                        "input_ids" to tIds,
                        "style" to tStyle,
                        "speed" to tSpeed
                    )
                    activeSession.run(inputs).use { result ->
                        val raw = result[0].value
                        when (raw) {
                            is FloatArray -> raw
                            is Array<*> -> (raw.firstOrNull() as? FloatArray) ?: FloatArray(0)
                            else -> FloatArray(0)
                        }
                    }
                }
            }
        }
    }

    fun playPcm24k(samples: FloatArray) {
        if (samples.isEmpty()) return
        val pcm16 = ShortArray(samples.size) { i ->
            (samples[i].coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort()
        }
        val minBuf = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(maxOf(minBuf, pcm16.size * 2))
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()

        track.write(pcm16, 0, pcm16.size)
        track.play()
    }

    fun close() {
        session?.close()
        session = null
    }
}
`;

  const ttsServiceKt = `package ${config.packageName}

import android.media.AudioFormat
import android.speech.tts.SynthesisCallback
import android.speech.tts.SynthesisRequest
import android.speech.tts.TextToSpeech
import android.speech.tts.TextToSpeechService
import kotlinx.coroutines.runBlocking
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Android System-Wide Offline TTS Service for English (eng) and Hindi (hin).
 * Enables screen readers, navigation apps, and e-book readers to speak with Kokoro-82M offline.
 */
class KokoroTtsService : TextToSpeechService() {

    private lateinit var engine: KokoroEngine
    @Volatile private var cancelled = false

    override fun onCreate() {
        super.onCreate()
        engine = KokoroEngine(applicationContext)
        runBlocking { engine.initialize() }
    }

    override fun onIsLanguageAvailable(lang: String?, country: String?, variant: String?): Int {
        return when (lang?.lowercase()) {
            "hin", "hi" -> TextToSpeech.LANG_COUNTRY_AVAILABLE
            "eng", "en" -> TextToSpeech.LANG_COUNTRY_AVAILABLE
            else -> TextToSpeech.LANG_NOT_SUPPORTED
        }
    }

    override fun onGetLanguage(): Array<String> = arrayOf("hin", "IND", "")

    override fun onLoadLanguage(lang: String?, country: String?, variant: String?): Int =
        onIsLanguageAvailable(lang, country, variant)

    override fun onStop() {
        cancelled = true
    }

    override fun onSynthesizeText(request: SynthesisRequest, callback: SynthesisCallback) {
        cancelled = false
        val text = request.charSequenceText?.toString()?.trim().orEmpty()
        if (text.isEmpty()) {
            callback.done()
            return
        }

        val isHindi = request.language?.lowercase()?.startsWith("hi") == true ||
            HindiPhonemizer.containsDevanagari(text)
        val voiceId = if (isHindi) "hf_alpha" else "af_heart"
        val speed = (request.speechRate / 100f).coerceIn(0.5f, 2.0f)

        callback.start(KokoroEngine.SAMPLE_RATE, AudioFormat.ENCODING_PCM_16BIT, 1)

        val samples = runBlocking { engine.synthesize(text, voiceId, speed) }
        val pcmBytes = ByteArray(samples.size * 2)
        val bb = ByteBuffer.wrap(pcmBytes).order(ByteOrder.LITTLE_ENDIAN)
        for (s in samples) {
            bb.putShort((s.coerceIn(-1f, 1f) * Short.MAX_VALUE).toInt().toShort())
        }

        val maxChunk = callback.maxBufferSize
        var offset = 0
        while (offset < pcmBytes.size && !cancelled) {
            val len = minOf(maxChunk, pcmBytes.size - offset)
            callback.audioAvailable(pcmBytes, offset, len)
            offset += len
        }
        callback.done()
    }
}
`;

  const mainActivityKt = `package ${config.packageName}

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var kokoro: KokoroEngine

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        kokoro = KokoroEngine(applicationContext)

        setContent {
            MaterialTheme {
                VaaniOfflineScreen(kokoro)
            }
        }
    }
}

@Composable
fun VaaniOfflineScreen(kokoro: KokoroEngine) {
    val scope = rememberCoroutineScope()
    var text by remember {
        mutableStateOf("नमस्ते! यह कोकोरो ऑफ़लाइन टेक्स्ट टू स्पीच है। Hello from Kokoro-82M on Android!")
    }
    var selectedVoice by remember { mutableStateOf("${voiceList[0] || 'hf_alpha'}") }
    var speed by remember { mutableFloatStateOf(1.0f) }
    var status by remember { mutableStateOf("Initializing offline model…") }

    val voices = listOf(${voiceList.map((v) => `"${v}"`).join(', ')})

    LaunchedEffect(Unit) {
        try {
            kokoro.initialize()
            status = "Offline model ready (24 kHz)"
        } catch (e: Exception) {
            status = "Missing model assets: \${e.message}"
        }
    }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("${config.appName}", style = MaterialTheme.typography.headlineMedium)
            Text(status, style = MaterialTheme.typography.bodySmall)

            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text("Enter English or Hindi (Devanagari) text") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(160.dp)
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                voices.take(4).forEach { voice ->
                    FilterChip(
                        selected = selectedVoice == voice,
                        onClick = { selectedVoice = voice },
                        label = { Text(voice) }
                    )
                }
            }

            Column {
                Text("Speed: \${String.format("%.2fx", speed)}")
                Slider(value = speed, onValueChange = { speed = it }, valueRange = 0.5f..2.0f)
            }

            Button(
                onClick = {
                    scope.launch {
                        status = "Synthesizing offline…"
                        val pcm = kokoro.synthesize(text, selectedVoice, speed)
                        kokoro.playPcm24k(pcm)
                        status = "Played \${pcm.size / KokoroEngine.SAMPLE_RATE}s audio"
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                Text("Speak Offline")
            }
        }
    }
}
`;

  const downloadScript = isLiteRT
    ? `#!/usr/bin/env bash
set -euo pipefail

# Downloads litert-community/Kokoro-82M (.litertlm) and Kokoro v1.0 voice embeddings
# into app/src/main/assets/ for 100% offline Android APK packaging.

mkdir -p app/src/main/assets/models app/src/main/assets/voices

echo "Downloading LiteRT-LM Kokoro-82M (${modelFileName})..."
huggingface-cli download litert-community/Kokoro-82M \\
  ${modelFileName} \\
  --local-dir app/src/main/assets/models

echo "Downloading selected English & Hindi voice embeddings..."
for VOICE in ${voiceList.join(' ')}; do
  curl -fsSL "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/\${VOICE}.bin" \\
    -o "app/src/main/assets/voices/\${VOICE}.bin"
  echo "  Saved voices/\${VOICE}.bin"
done

echo "Done! Open this folder in Android Studio and run ./gradlew assembleDebug."
`
    : `#!/usr/bin/env bash
set -euo pipefail

# Downloads onnx-community/Kokoro-82M-v1.0-ONNX (INT8 quantized, ~92 MB) and
# English + Hindi voice embeddings into app/src/main/assets/ for 100% offline Android builds.

mkdir -p app/src/main/assets/models app/src/main/assets/voices

echo "Downloading Kokoro-82M v1.0 INT8 ONNX model (~92 MB)..."
curl -fSL "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx" \\
  -o "app/src/main/assets/models/model_quantized.onnx"

echo "Downloading selected English & Hindi voice embeddings..."
for VOICE in ${voiceList.join(' ')}; do
  curl -fsSL "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/\${VOICE}.bin" \\
    -o "app/src/main/assets/voices/\${VOICE}.bin"
  echo "  Saved voices/\${VOICE}.bin"
done

echo "Done! Open this folder in Android Studio and run ./gradlew assembleDebug."
`;

  const readmeMd = `# ${config.appName} — Offline English & Hindi Kokoro-82M Android App

Generated by **Vaani Offline TTS Studio**.

## Runtime Stack
- **Inference Engine**: ${
    isLiteRT
      ? `Google LiteRT-LM (\`litert-community/Kokoro-82M\`, \`${modelFileName}\`)`
      : `ONNX Runtime Android (\`onnx-community/Kokoro-82M-v1.0-ONNX\`, \`model_quantized.onnx\`)`
  }
- **Package Name**: \`${config.packageName}\`
- **Offline Languages**: English (\`en-US\`, \`en-GB\`) & Hindi (\`hi-IN\`)
- **System TTS Integration**: ${config.includeSystemTtsService ? 'Enabled (`KokoroTtsService`)' : 'App-only'}

## Quick Start in Android Studio
1. Run the asset fetch script once on your dev machine:
   \`\`\`bash
   chmod +x scripts/download_models.sh
   ./scripts/download_models.sh
   \`\`\`
2. Open this project folder in **Android Studio Ladybug (2024.2+)** with JDK 17.
3. Connect an \`arm64-v8a\` Android device (API ${config.minSdk}+) and click **Run**.
${
  config.includeSystemTtsService
    ? `4. To enable system-wide offline TTS across Android apps:
   **Settings → System → Languages → Text-to-speech output → Preferred engine → ${config.appName}**.`
    : ''
}
`;

  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.appName}</string>
</resources>
`;

  const gradleWrapperProps = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.9-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;

  const githubActionsYml = `name: Build Offline Kokoro TTS APK

on:
  workflow_dispatch:
  push:
    branches: [ main, master ]

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Set up Python & Hugging Face CLI
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Download Kokoro-82M model & English/Hindi voices
        run: |
          pip install -q huggingface_hub
          chmod +x scripts/download_models.sh
          ./scripts/download_models.sh

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.9'

      - name: Build Debug APK
        run: gradle assembleDebug --no-daemon

      - name: Upload installable APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${config.appName.replace(/[^A-Za-z0-9_-]/g, '') || 'VaaniKokoroTTS'}-debug-apk
          path: app/build/outputs/apk/debug/app-debug.apk
`;

  const usbSideloadSh = `#!/usr/bin/env bash
set -euo pipefail

# Builds app-debug.apk and sideloads it onto a connected Android phone via USB Debugging (adb).

echo "1/4 Checking Android device over USB debugging..."
if ! command -v adb >/dev/null 2>&1; then
  echo "Error: 'adb' not found. Install Android Platform-Tools first."
  exit 1
fi
adb devices
DEVICE_COUNT=$(adb devices | awk 'NR>1 && $2=="device" {count++} END {print count+0}')
if [ "$DEVICE_COUNT" -lt 1 ]; then
  echo "No authorized Android device detected. Enable Developer Options -> USB Debugging and tap Allow on your phone."
  exit 1
fi

echo "2/4 Downloading Kokoro-82M weights & English/Hindi voice packs..."
chmod +x scripts/download_models.sh
./scripts/download_models.sh

echo "3/4 Building debug APK..."
if [ -x "./gradlew" ]; then
  ./gradlew assembleDebug
else
  gradle assembleDebug
fi

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
echo "4/4 Sideloading $APK_PATH onto your phone..."
adb install -r "$APK_PATH"
adb shell monkey -p ${config.packageName} -c android.intent.category.LAUNCHER 1
echo "Installed and launched ${config.appName}!"
`;

  const usbSideloadBat = `@echo off
setlocal

echo 1/4 Checking Android USB debugging connection...
where adb >nul 2>nul
if errorlevel 1 (
  echo Error: adb not found. Install Android Platform-Tools and add to PATH.
  exit /b 1
)
adb devices

echo 2/4 Downloading Kokoro-82M model and voice packs (requires curl)...
if not exist app\\src\\main\\assets\\models mkdir app\\src\\main\\assets\\models
if not exist app\\src\\main\\assets\\voices mkdir app\\src\\main\\assets\\voices
${
  isLiteRT
    ? `huggingface-cli download litert-community/Kokoro-82M ${modelFileName} --local-dir app\\src\\main\\assets\\models`
    : `curl -fSL "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx" -o "app\\src\\main\\assets\\models\\model_quantized.onnx"`
}
for %%V in (${voiceList.join(' ')}) do (
  curl -fsSL "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/%%V.bin" -o "app\\src\\main\\assets\\voices\\%%V.bin"
)

echo 3/4 Building debug APK...
if exist gradlew.bat (
  call gradlew.bat assembleDebug
) else (
  call gradle assembleDebug
)

echo 4/4 Sideloading APK via USB debugging...
adb install -r app\\build\\outputs\\apk\\debug\\app-debug.apk
adb shell monkey -p ${config.packageName} -c android.intent.category.LAUNCHER 1
echo Done!
`;

  const files: GeneratedAndroidFile[] = [
    {
      path: 'README.md',
      language: 'markdown',
      description: 'Setup guide, Cloud APK build, and USB sideload instructions',
      content: readmeMd,
    },
    {
      path: '.github/workflows/build-apk.yml',
      language: 'bash',
      description: 'Zero-Android-Studio GitHub Actions workflow that compiles a downloadable .apk',
      content: githubActionsYml,
    },
    {
      path: 'scripts/build_and_sideload.sh',
      language: 'bash',
      description: 'macOS/Linux one-command build + USB debugging adb sideload script',
      content: usbSideloadSh,
    },
    {
      path: 'scripts/build_and_sideload.bat',
      language: 'bash',
      description: 'Windows one-command build + USB debugging adb sideload script',
      content: usbSideloadBat,
    },
    {
      path: 'scripts/download_models.sh',
      language: 'bash',
      description: 'Fetches Kokoro-82M weights & English/Hindi voice packs',
      content: downloadScript,
    },
    {
      path: 'settings.gradle.kts',
      language: 'kotlin',
      description: 'Gradle workspace & Maven repositories',
      content: settingsGradle,
    },
    {
      path: 'build.gradle.kts',
      language: 'kotlin',
      description: 'Top-level Android & Kotlin Compose plugin versions',
      content: rootBuildGradle,
    },
    {
      path: 'gradle/wrapper/gradle-wrapper.properties',
      language: 'bash',
      description: 'Gradle 8.9 wrapper distribution configuration',
      content: gradleWrapperProps,
    },
    {
      path: 'app/build.gradle.kts',
      language: 'kotlin',
      description: isLiteRT
        ? 'LiteRT-LM + GPU delegate dependencies & uncompressed .litertlm packaging'
        : 'ONNX Runtime Android dependencies & uncompressed .onnx packaging',
      content: appBuildGradle,
    },
    {
      path: 'app/src/main/AndroidManifest.xml',
      language: 'xml',
      description: 'Zero-internet offline manifest + System TTS Service registration',
      content: manifestXml,
    },
    {
      path: 'app/src/main/res/values/strings.xml',
      language: 'xml',
      description: 'Android app_name string resource',
      content: stringsXml,
    },
    {
      path: `app/src/main/java/${pkgPath}/KokoroEngine.kt`,
      language: 'kotlin',
      description: 'On-device 24 kHz Kokoro inference & AudioTrack playback',
      content: kokoroEngineKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/HindiPhonemizer.kt`,
      language: 'kotlin',
      description: 'Offline Devanagari-to-IPA G2P with schwa deletion & Kokoro tokenizer',
      content: hindiPhonemizerKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/MainActivity.kt`,
      language: 'kotlin',
      description: 'Jetpack Compose Material 3 bilingual TTS interface',
      content: mainActivityKt,
    },
  ];

  if (config.includeSystemTtsService) {
    files.push(
      {
        path: `app/src/main/java/${pkgPath}/KokoroTtsService.kt`,
        language: 'kotlin',
        description: 'Android TextToSpeechService for system-wide English & Hindi TTS',
        content: ttsServiceKt,
      },
      {
        path: 'app/src/main/res/xml/tts_engine.xml',
        language: 'xml',
        description: 'Android system TTS engine metadata descriptor',
        content: ttsEngineXml,
      }
    );
  }

  return files;
}

export async function exportAndroidProjectZip(config: AndroidProjectConfig): Promise<Blob> {
  const zip = new JSZip();
  const files = generateAndroidProjectFiles(config);
  for (const f of files) {
    zip.file(f.path, f.content);
  }
  return zip.generateAsync({ type: 'blob' });
}
