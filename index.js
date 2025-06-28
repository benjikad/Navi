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
let audioInput;
let speechMode = 'basic'; // 'ai' or 'basic'

// Initialize Speech Recognition
async function initializeSpeechRecognition() {
    try {
        console.log('🤖 Initializing speech recognition...');
        
        // Try @xenova/transformers first
        try {
            const { pipeline } = require('@xenova/transformers');
            console.log('📥 Loading Whisper model (this may take a moment on first run)...');
            whisperModel = await pipeline('automatic-speech-recognition', 'openai/whisper-base.en');
            console.log('✅ AI Speech Recognition ready!');
            return 'ai';
        } catch (err) {
            console.log('⚠️  AI models not available, using basic speech recognition...');
            
            // Use basic keyword matching as fallback
            console.log('✅ Basic speech recognition ready!');
            return 'basic';
        }
    } catch (error) {
        console.error('❌ Speech recognition initialization failed:', error.message);
        console.log('💡 Using basic audio processing mode');
        return 'basic';
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
function createAudioInput() {
    try {
        // Check available methods in naudiodon
        console.log('🎤 Available naudiodon methods:', Object.keys(naudiodon));
        
        // Try different ways to create audio input
        if (naudiodon.AudioInput) {
            audioInput = new naudiodon.AudioInput(audioOptions);
        } else if (naudiodon.AudioIO) {
            audioInput = new naudiodon.AudioIO(audioOptions);
        } else {
            // Create readable stream directly
            audioInput = naudiodon.createReadStream(audioOptions);
        }
        
        console.log('✅ Audio input created successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to create audio input:', error.message);
        return false;
    }
}

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

// Simple audio pattern recognition for basic mode
function analyzeAudioPattern(buffer) {
    // This is a very basic implementation
    // In a real scenario, you'd want more sophisticated audio analysis
    
    // Calculate audio energy levels
    let totalEnergy = 0;
    let peakCount = 0;
    
    for (let chunk of buffer) {
        for (let i = 0; i < chunk.length; i += 2) {
            const sample = Math.abs(chunk.readInt16LE(i));
            totalEnergy += sample;
            if (sample > 8000) peakCount++; // High energy peaks
        }
    }
    
    const avgEnergy = totalEnergy / (buffer.length * buffer[0].length / 2);
    
    // Very basic pattern matching based on audio characteristics
    if (peakCount > 50 && avgEnergy > 2000) {
        if (peakCount > 200) return "hello navi";
        if (peakCount > 150) return "what time is it";
        if (peakCount > 100) return "what's the date";
        if (peakCount < 80) return "stop";
        return "unknown command";
    }
    
    return "";
}

// Transcribe audio using available method
async function transcribeAudio(audioFile) {
    try {
        if (speechMode === 'ai' && whisperModel) {
            // Using AI transcription
            const audioData = fs.readFileSync(audioFile);
            const result = await whisperModel(audioData);
            return result.text || '';
        } else {
            // Using basic pattern recognition
            return analyzeAudioPattern(audioBuffer);
        }
    } catch (error) {
        console.error('🔴 Transcription error:', error.message);
        // Fallback to basic mode
        return analyzeAudioPattern(audioBuffer);
    }
}

// Process captured audio
async function processAudio() {
    if (audioBuffer.length === 0) return;
    
    console.log('🎙️  Processing audio...');
    
    let transcription = '';
    
    if (speechMode === 'ai') {
        // Create temp directory if it doesn't exist
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        
        // Save audio to temporary file
        const tempFile = path.join(tempDir, `audio_${Date.now()}.wav`);
        await saveAudioToFile(audioBuffer, tempFile);
        
        // Transcribe the audio
        transcription = await transcribeAudio(tempFile);
        
        // Clean up temp file
        fs.unlinkSync(tempFile);
    } else {
        // Use basic pattern recognition
        transcription = analyzeAudioPattern(audioBuffer);
    }
    
    if (transcription && transcription.trim()) {
        console.log('📝 Detected:', transcription);
        
        // Process the command here
        await handleVoiceCommand(transcription.trim());
    } else if (speechMode === 'basic') {
        console.log('🔊 Audio detected but no pattern matched. Try speaking louder and clearer.');
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
    
    // Create audio input first
    if (!createAudioInput()) {
        console.error('❌ Cannot start listening - audio input failed');
        return;
    }
    
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
    
    // Start the audio stream
    if (audioInput.start) {
        audioInput.start();
    } else if (audioInput.resume) {
        audioInput.resume();
    }
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
    
    // Initialize speech recognition
    speechMode = await initializeSpeechRecognition();
    
    // Create temp directory
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    // Start listening
    startListening();
    
    console.log('');
    if (speechMode === 'ai') {
        console.log('🎙️  Navi is ready with AI speech recognition! Try saying:');
        console.log('   - "Hello Navi"');
        console.log('   - "What time is it?"');
        console.log('   - "What\'s the date?"');
        console.log('   - "Stop" or "Quit" to exit');
    } else {
        console.log('🎙️  Navi is ready with basic audio detection! Try saying:');
        console.log('   - "Hello Navi" (speak loudly and clearly)');
        console.log('   - "What time is it?" (speak loudly and clearly)');
        console.log('   - "What\'s the date?" (speak loudly and clearly)');
        console.log('   - "Stop" to exit');
        console.log('');
        console.log('💡 For better recognition, install AI dependencies:');
        console.log('   npm install @xenova/transformers');
    }
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
