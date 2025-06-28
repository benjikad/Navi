console.log("=================================");
console.log("    Navi Voice Assistant v1.0    ");
console.log("=================================");
console.log("");

const Porcupine = require('@picovoice/porcupine-node');
const recorder = require('node-record-lpcm16');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const compromise = require('compromise');

class NaviVoiceAssistant {
    constructor() {
        this.isListening = false;
        this.isProcessingCommand = false;
        this.porcupine = null;
        this.recordingStream = null;
        this.accessKey = process.env.PICOVOICE_ACCESS_KEY; // You'll need to set this
        
        this.init();
    }

    async init() {
        console.log('🤖 Initializing Navi Voice Assistant...');
        
        try {
            // Initialize Porcupine for wake word detection
            this.porcupine = new Porcupine(
                this.accessKey,
                ['hey navi'], // Wake word
                [0.5] // Sensitivity (0.0 to 1.0)
            );
            
            console.log('✅ Porcupine initialized successfully');
            console.log('🎤 Say "Hey Navi" to activate...');
            
            this.startListening();
        } catch (error) {
            console.error('❌ Failed to initialize Porcupine:', error.message);
            console.log('💡 Make sure to set PICOVOICE_ACCESS_KEY environment variable');
            console.log('💡 Get your free access key from: https://console.picovoice.ai/');
        }
    }

    startListening() {
        this.isListening = true;
        
        // Start recording audio
        this.recordingStream = recorder.record({
            sampleRateHertz: 16000,
            threshold: 0,
            verbose: false,
            recordProgram: 'sox', // or 'rec' on some systems
            silence: '1.0s',
        }).stream();

        const frameLength = this.porcupine.frameLength;
        const audioBuffer = [];

        this.recordingStream.on('data', (data) => {
            if (!this.isListening) return;

            // Convert buffer to 16-bit PCM
            for (let i = 0; i < data.length; i += 2) {
                audioBuffer.push(data.readInt16LE(i));
            }

            // Process audio frames for wake word detection
            while (audioBuffer.length >= frameLength) {
                const frame = audioBuffer.splice(0, frameLength);
                
                try {
                    const keywordIndex = this.porcupine.process(frame);
                    if (keywordIndex >= 0) {
                        console.log('👂 Wake word detected! Listening for command...');
                        this.handleWakeWord();
                    }
                } catch (error) {
                    console.error('Error processing audio frame:', error);
                }
            }
        });

        this.recordingStream.on('error', (error) => {
            console.error('❌ Recording error:', error);
            this.restartListening();
        });
    }

    async handleWakeWord() {
        if (this.isProcessingCommand) return;
        
        this.isProcessingCommand = true;
        this.isListening = false;

        try {
            // Record command audio for 3 seconds
            console.log('🎙️  Recording command...');
            const audioFile = await this.recordCommand(3000);
            
            // Process with Whisper
            console.log('🧠 Processing speech...');
            const transcription = await this.transcribeAudio(audioFile);
            
            if (transcription) {
                console.log(`💬 You said: "${transcription}"`);
                await this.processCommand(transcription);
            } else {
                console.log('❌ Could not understand the command');
            }
            
            // Clean up
            fs.unlinkSync(audioFile);
            
        } catch (error) {
            console.error('❌ Error processing command:', error);
        } finally {
            this.isProcessingCommand = false;
            this.isListening = true;
            console.log('🎤 Listening for "Hey Navi" again...');
        }
    }

    recordCommand(duration) {
        return new Promise((resolve, reject) => {
            const filename = `command_${Date.now()}.wav`;
            const filepath = path.join(__dirname, filename);
            
            const recording = recorder.record({
                sampleRateHertz: 16000,
                threshold: 0,
                verbose: false,
                recordProgram: 'sox',
                silence: '1.0s',
            });

            const writeStream = fs.createWriteStream(filepath);
            recording.stream().pipe(writeStream);

            // Stop recording after duration
            setTimeout(() => {
                recording.stop();
                writeStream.end();
                resolve(filepath);
            }, duration);

            writeStream.on('error', reject);
        });
    }

    async transcribeAudio(audioFile) {
        return new Promise((resolve, reject) => {
            // Using whisper-node to transcribe
            const whisper = spawn('whisper', [
                audioFile,
                '--model', 'base',
                '--output_format', 'txt',
                '--language', 'en'
            ]);

            let output = '';
            let error = '';

            whisper.stdout.on('data', (data) => {
                output += data.toString();
            });

            whisper.stderr.on('data', (data) => {
                error += data.toString();
            });

            whisper.on('close', (code) => {
                if (code === 0) {
                    // Read the generated text file
                    const textFile = audioFile.replace('.wav', '.txt');
                    if (fs.existsSync(textFile)) {
                        const transcription = fs.readFileSync(textFile, 'utf8').trim();
                        fs.unlinkSync(textFile); // Clean up
                        resolve(transcription);
                    } else {
                        resolve('');
                    }
                } else {
                    console.error('Whisper error:', error);
                    reject(new Error(`Whisper failed with code ${code}`));
                }
            });
        });
    }

    async processCommand(transcription) {
        const doc = compromise(transcription.toLowerCase());
        const text = doc.text();

        console.log('🔍 Processing command:', text);

        // Remove "hey navi" from the beginning if present
        const command = text.replace(/^hey navi\s*/i, '').trim();

        // Command routing
        switch (true) {
            case command.includes('test'):
                await this.handleTestCommand();
                break;
                
            case command.includes('time'):
                await this.handleTimeCommand();
                break;
                
            case command.includes('date'):
                await this.handleDateCommand();
                break;
                
            case command.includes('hello') || command.includes('hi'):
                await this.handleGreetingCommand();
                break;
                
            case command.includes('stop') || command.includes('quit') || command.includes('exit'):
                await this.handleStopCommand();
                break;
                
            default:
                await this.handleUnknownCommand(command);
                break;
        }
    }

    async handleTestCommand() {
        console.log('✅ Test command executed successfully!');
        console.log('🎉 Navi is working properly!');
        this.speak('Test command received. Navi is working properly!');
    }

    async handleTimeCommand() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        console.log(`🕐 Current time: ${timeString}`);
        this.speak(`The current time is ${timeString}`);
    }

    async handleDateCommand() {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        console.log(`📅 Current date: ${dateString}`);
        this.speak(`Today is ${dateString}`);
    }

    async handleGreetingCommand() {
        const greetings = [
            'Hello! How can I help you?',
            'Hi there! What can I do for you?',
            'Hey! I\'m here to assist you.',
            'Hello! Ready to help!'
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        console.log(`👋 ${greeting}`);
        this.speak(greeting);
    }

    async handleStopCommand() {
        console.log('👋 Goodbye! Shutting down Navi...');
        this.speak('Goodbye!');
        setTimeout(() => {
            this.cleanup();
            process.exit(0);
        }, 2000);
    }

    async handleUnknownCommand(command) {
        console.log(`❓ Unknown command: "${command}"`);
        const responses = [
            "I didn't understand that command.",
            "Sorry, I'm not sure what you mean.",
            "Could you try rephrasing that?",
            "I don't know how to do that yet."
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        this.speak(response);
    }

    speak(text) {
        console.log(`🗣️  Navi says: "${text}"`);
        // You can implement TTS here using a library like 'say' or 'espeak'
        // For now, just logging to console
    }

    restartListening() {
        console.log('🔄 Restarting audio listening...');
        if (this.recordingStream) {
            this.recordingStream.destroy();
        }
        setTimeout(() => {
            this.startListening();
        }, 1000);
    }

    cleanup() {
        console.log('🧹 Cleaning up resources...');
        if (this.porcupine) {
            this.porcupine.release();
        }
        if (this.recordingStream) {
            this.recordingStream.destroy();
        }
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Start the assistant
const navi = new NaviVoiceAssistant();

console.log(`
╔══════════════════════════════════════╗
║           NAVI VOICE ASSISTANT       ║
║                                      ║
║  Say "Hey Navi" followed by:         ║
║  • "test" - Test the system          ║
║  • "time" - Get current time         ║
║  • "date" - Get current date         ║
║  • "hello" - Get a greeting          ║
║  • "stop" - Shutdown Navi            ║
║                                      ║
║  Press Ctrl+C to exit                ║
╚══════════════════════════════════════╝
`);

// Simple keep-alive
setInterval(() => {
    // Navi main loop will go here
}, 5000);
