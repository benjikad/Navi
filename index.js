const naudiodon = require('naudiodon');
const fs = require('fs');
const path = require('path');
const wav = require('wav');
const say = require('say');

let whisper;
let isListening = false;
let audioBuffer = [];
let silenceTimeout;
let whisperModel;

// Initialize Whisper AI
async function initializeWhisper() {
    try {
        console.log('🤖 Initializing AI speech recognition...');
        
        // Try node-whisper first
        try {
            whisper = require('node-whisper');
            console.log('📥 Loading Whisper model (this may take a moment on first run)...');
            whisperModel = await whisper.load('base'); // Downloads ~140MB once
            console.log('✅ Whisper AI ready!');
            return true;
        } catch (err) {
            console.log('⚠️  node-whisper failed, trying whisper-node...');
            
            // Fallback to whisper-node
            whisper = require('whisper-node');
            console.log('✅ Whisper AI ready (fallback mode)!');
            return true;
        }
    } catch (error) {
        console.error('❌ Failed to initialize Whisper AI:', error.message);
        console.log('💡 Make sure you ran: npm install node-whisper');
        return false;
    }
}

// Audio input settings
const audioOptions = {
    channelCount: 1,        // Mono
    sampleFormat: 16,       // 16-bit
    sampleRate: 16000,      // 16kHz (Whisper's preferred rate)
    deviceId: -1,           // Default input device
    closeOnError: true
};

// Create audio input stream
const audioInput = new naudiodon.AudioInput(audioOptions);

// Voice Activity Detection (simple silence detection)
function detectVoiceActivity(chunk) {
    // Calculate RMS (Root Mean Square) for volume detection
    let sum = 0;
    for (let i = 0; i < chunk.length; i += 2) {
        const sample = chunk.readInt16LE(i);
        sum += sample * sample;
    }
    const rms = Math.sqrt(sum / (chunk.length / 2));
    
    // Threshold for voice detection (adjust as needed)
    const voiceThreshold = 500;
    return rms > voiceThreshold;
}

// Save audio buffer to WAV file
function saveAudioToFile(buffer, filename) {
    const writer = new wav.FileWriter(filename, {
        channels: 1,
        sampleRate: 16000,
        bitDepth: 16
    });
    
    writer.write(Buffer.concat(buffer));
    writer.end();
    
    return new Promise((resolve) => {
        writer.on('done', resolve);
    });
}

// Transcribe audio using Whisper
async function transcribeAudio(audioFile) {
    try {
        if (whisperModel) {
            // Using node-whisper
            const result = await whisperModel.transcribe(audioFile);
            return result.text || result;
        } else {
            // Using whisper-node
            const options = {
                modelName: "base.en",
                whisperOptions: {
                    language: 'en',
                    word_timestamps: false,
                    temperature: 0.2
                }
            };
            
            const result = await whisper(audioFile, options);
            return result[0]?.speech || '';
        }
    } catch (error) {
        console.error('🔴 Transcription error:', error.message);
        return '';
    }
}

// Process captured audio
async function processAudio() {
    if (audioBuffer.length === 0) return;
    
    console.log('🎙️  Processing audio...');
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    // Save audio to temporary file
    const tempFile = path.join(tempDir, `audio_${Date.now()}.wav`);
    await saveAudioToFile(audioBuffer, tempFile);
    
    // Transcribe the audio
    const transcription = await transcribeAudio(tempFile);
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    if (transcription && transcription.trim()) {
        console.log('📝 You said:', transcription);
        
        // Process the command here
        await handleVoiceCommand(transcription.trim());
    }
    
    // Clear the buffer
    audioBuffer = [];
}

// Handle voice commands
async function handleVoiceCommand(text) {
    const command = text.toLowerCase();
    
    console.log('🤔 Processing command:', command);
    
    // Basic command examples - expand this as needed
    if (command.includes('hello') || command.includes('hi')) {
        const response = "Hello! I'm Navi, your voice assistant.";
        console.log('🗣️  Navi:', response);
        say.speak(response);
    }
    else if (command.includes('time')) {
        const time = new Date().toLocaleTimeString();
        const response = `The current time is ${time}`;
        console.log('🗣️  Navi:', response);
        say.speak(response);
    }
    else if (command.includes('date')) {
        const date = new Date().toLocaleDateString();
        const response = `Today's date is ${date}`;
        console.log('🗣️  Navi:', response);
        say.speak(response);
    }
    else if (command.includes('stop') || command.includes('quit') || command.includes('exit')) {
        const response = "Goodbye!";
        console.log('🗣️  Navi:', response);
        say.speak(response);
        setTimeout(() => process.exit(0), 2000);
    }
    else {
        const response = `I heard you say: ${text}. I'm still learning new commands!`;
        console.log('🗣️  Navi:', response);
        say.speak(response);
    }
}

// Start listening for audio
function startListening() {
    if (isListening) return;
    
    isListening = true;
    console.log('👂 Listening for voice commands... (speak now)');
    
    audioInput.on('data', (chunk) => {
        if (detectVoiceActivity(chunk)) {
            // Voice detected - add to buffer and reset silence timer
            audioBuffer.push(chunk);
            
            // Clear existing silence timeout
            if (silenceTimeout) {
                clearTimeout(silenceTimeout);
            }
            
            // Set new silence timeout (1 second of silence = end of speech)
            silenceTimeout = setTimeout(async () => {
                if (audioBuffer.length > 0) {
                    await processAudio();
                    console.log('👂 Ready for next command...');
                }
            }, 1000);
        }
    });
    
    audioInput.on('error', (err) => {
        console.error('🔴 Audio input error:', err);
        restartListening();
    });
    
    audioInput.start();
}

// Restart listening after error
function restartListening() {
    console.log('🔄 Restarting audio input...');
    isListening = false;
    setTimeout(startListening, 1000);
}

// Initialize and start Navi
async function main() {
    console.log('🚀 Starting Navi Voice Assistant...');
    
    // Initialize Whisper AI
    const whisperReady = await initializeWhisper();
    if (!whisperReady) {
        console.log('❌ Cannot start without AI speech recognition');
        process.exit(1);
    }
    
    // Create temp directory
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    // Start listening
    startListening();
    
    console.log('');
    console.log('🎙️  Navi is ready! Try saying:');
    console.log('   - "Hello Navi"');
    console.log('   - "What time is it?"');
    console.log('   - "What\'s the date?"');
    console.log('   - "Stop" or "Quit" to exit');
    console.log('');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Navi...');
    if (audioInput) {
        audioInput.quit();
    }
    process.exit(0);
});

// Start the application
main().catch(console.error);
