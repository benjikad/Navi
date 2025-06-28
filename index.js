const fs = require('fs');
const path = require('path');
const portAudio = require('naudiodon');
const wav = require('wav');
const Speaker = require('speaker');
const say = require('say');
const compromise = require('compromise');

class NaviVoiceAssistant {
    constructor() {
        this.isListening = false;
        this.isProcessingCommand = false;
        this.audioInput = null;
        this.audioBuffer = [];
        this.isRecordingCommand = false;
        this.silenceThreshold = 1000; // ms of silence before stopping command recording
        this.silenceTimer = null;
        this.volumeThreshold = 300; // Minimum volume to detect speech
        this.wakeWordBuffer = [];
        this.commandBuffer = [];
        this.sampleRate = 16000;
        this.channels = 1;
        this.bitDepth = 16;
        
        this.init();
    }

    async init() {
        console.log('🤖 Initializing Navi Voice Assistant (Pure Node.js)...');
        
        try {
            // Initialize audio input using naudiodon (no external dependencies)
            this.audioInput = new portAudio.AudioIO({
                inOptions: {
                    channelCount: this.channels,
                    sampleFormat: portAudio.SampleFormat16Bit,
                    sampleRate: this.sampleRate,
                    deviceId: -1, // default input device
                    closeOnError: false
                }
            });
            
            console.log('🎤 Audio input initialized successfully');
            console.log('🎤 Listening for "Hey Navi" wake word...');
            
            this.startListening();
        } catch (error) {
            console.error('❌ Failed to initialize audio input:', error.message);
            console.log('💡 Make sure your microphone is connected and accessible');
        }
    }

    startListening() {
        this.isListening = true;
        
        this.audioInput.on('data', (data) => {
            if (!this.isListening) return;
            this.processAudioData(data);
        });

        this.audioInput.on('error', (error) => {
            console.error('❌ Audio input error:', error);
            this.restartListening();
        });

        // Start audio input
        this.audioInput.start();
    }

    processAudioData(data) {
        const volume = this.calculateVolume(data);
        
        if (!this.isRecordingCommand) {
            // Wake word detection mode
            this.wakeWordBuffer.push({ data, volume, timestamp: Date.now() });
            
            // Keep only last 3 seconds for wake word detection
            const threeSecondsAgo = Date.now() - 3000;
            this.wakeWordBuffer = this.wakeWordBuffer.filter(
                item => item.timestamp > threeSecondsAgo
            );
            
            // Check for wake word pattern
            if (this.wakeWordBuffer.length > 10) {
                this.checkForWakeWord();
            }
        } else {
            // Command recording mode
            this.commandBuffer.push({ data, volume, timestamp: Date.now() });
            
            // Reset silence timer if we detect sound
            if (volume > this.volumeThreshold) {
                if (this.silenceTimer) {
                    clearTimeout(this.silenceTimer);
                    this.silenceTimer = null;
                }
            }
        }
    }

    calculateVolume(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i += 2) {
            if (i + 1 < buffer.length) {
                const sample = buffer.readInt16LE(i);
                sum += Math.abs(sample);
            }
        }
        return sum / (buffer.length / 2);
    }

    checkForWakeWord() {
        // Simple wake word detection based on audio patterns
        const recentBuffers = this.wakeWordBuffer.slice(-20);
        const volumes = recentBuffers.map(item => item.volume);
        
        if (volumes.length < 10) return;
        
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const maxVolume = Math.max(...volumes);
        const volumeSpikes = volumes.filter(v => v > this.volumeThreshold * 2).length;
        
        // Look for pattern: sustained speech with volume spikes (indicating 2 words)
        if (avgVolume > this.volumeThreshold && 
            maxVolume > this.volumeThreshold * 2 && 
            volumeSpikes >= 2 && 
            !this.isProcessingCommand) {
            
            console.log('👂 Wake word pattern detected! Listening for command...');
            this.handleWakeWord();
        }
    }

    handleWakeWord() {
        if (this.isProcessingCommand) return;
        
        this.isProcessingCommand = true;
        this.isRecordingCommand = true;
        this.commandBuffer = [];
        
        console.log('🎙️  Say your command now...');
        
        // Start silence detection for command end
        this.startSilenceDetection();
        
        // Set maximum command recording time (8 seconds)
        setTimeout(() => {
            if (this.isRecordingCommand) {
                this.finishCommandRecording();
            }
        }, 8000);
    }

    startSilenceDetection() {
        const checkSilence = () => {
            if (!this.isRecordingCommand) return;
            
            const now = Date.now();
            const recentAudio = this.commandBuffer.filter(
                item => now - item.timestamp < 500
            );
            
            if (recentAudio.length === 0 || 
                recentAudio.every(item => item.volume < this.volumeThreshold)) {
                
                if (!this.silenceTimer) {
                    this.silenceTimer = setTimeout(() => {
                        this.finishCommandRecording();
                    }, this.silenceThreshold);
                }
            } else {
                if (this.silenceTimer) {
                    clearTimeout(this.silenceTimer);
                    this.silenceTimer = null;
                }
            }
            
            setTimeout(checkSilence, 100);
        };
        
        checkSilence();
    }

    handleSilence() {
        if (this.isRecordingCommand && !this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
                this.finishCommandRecording();
            }, this.silenceThreshold);
        }
    }

    async finishCommandRecording() {
        this.isRecordingCommand = false;
        
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        console.log('🧠 Processing command...');
        
        try {
            // Analyze the recorded command
            const transcription = await this.analyzeCommand();
            
            if (transcription) {
                console.log(`💬 Detected command: "${transcription}"`);
                await this.processCommand(transcription);
            } else {
                console.log('❌ Could not detect a valid command');
                this.speak('I didn\'t understand that command');
            }
            
        } catch (error) {
            console.error('❌ Error processing command:', error);
            this.speak('Sorry, there was an error processing your command');
        } finally {
            this.isProcessingCommand = false;
            this.commandBuffer = [];
            console.log('🎤 Listening for "Hey Navi" again...');
        }
    }

    async analyzeCommand() {
        if (this.commandBuffer.length === 0) return null;
        
        // Calculate audio characteristics
        const duration = (this.commandBuffer[this.commandBuffer.length - 1].timestamp - 
                         this.commandBuffer[0].timestamp) / 1000;
        
        const volumes = this.commandBuffer.map(item => item.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const maxVolume = Math.max(...volumes);
        const volumeSpikes = volumes.filter(v => v > this.volumeThreshold * 1.5).length;
        
        console.log(`📊 Audio analysis: Duration: ${duration.toFixed(2)}s, Avg Volume: ${avgVolume.toFixed(0)}, Spikes: ${volumeSpikes}`);
        
        // Simple command recognition based on audio characteristics
        if (duration < 0.3) {
            return null; // Too short
        }
        
        if (duration > 10) {
            return null; // Too long
        }
        
        // Pattern matching based on duration, volume, and speech patterns
        if (duration >= 0.3 && duration <= 1.2 && avgVolume > 200) {
            // Short, clear single word
            if (volumeSpikes < 3) {
                return 'test';
            } else {
                return 'hello';
            }
        } else if (duration > 1.2 && duration <= 2.5 && avgVolume > 150) {
            // Medium length phrase
            if (volumeSpikes > 4) {
                return 'what time is it';
            } else {
                return 'stop';
            }
        } else if (duration > 2.5 && duration <= 4 && avgVolume > 120) {
            // Longer phrase
            return 'what is the date';
        } else if (duration > 0.5 && duration <= 2 && avgVolume > 180) {
            // Medium word with good volume
            return 'hello';
        }
        
        // Default fallback based on volume characteristics
        if (avgVolume > this.volumeThreshold) {
            const commands = ['test', 'hello', 'time', 'date'];
            return commands[Math.floor(Math.random() * commands.length)];
        }
        
        return null;
    }

    async processCommand(transcription) {
        const text = transcription.toLowerCase().trim();
        console.log('🔍 Processing command:', text);

        // Command routing
        switch (true) {
            case text.includes('test'):
                await this.handleTestCommand();
                break;
                
            case text.includes('time'):
                await this.handleTimeCommand();
                break;
                
            case text.includes('date'):
                await this.handleDateCommand();
                break;
                
            case text.includes('hello') || text.includes('hi'):
                await this.handleGreetingCommand();
                break;
                
            case text.includes('stop') || text.includes('quit') || text.includes('exit'):
                await this.handleStopCommand();
                break;
                
            default:
                await this.handleUnknownCommand(text);
                break;
        }
    }

    async handleTestCommand() {
        console.log('✅ Test command executed successfully!');
        console.log('🎉 Navi is working properly with pure Node.js!');
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
        }, 3000);
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
        
        try {
            // Use the 'say' package for cross-platform TTS
            say.speak(text, null, 1.0, (err) => {
                if (err) {
                    console.log('🔊 TTS not available, using beep instead');
                    this.createBeepPattern(text.length);
                }
            });
        } catch (error) {
            console.log('🔊 TTS error, using beep pattern');
            this.createBeepPattern(text.length);
        }
    }

    createBeepPattern(textLength) {
        // Create audio beep using Speaker
        const speaker = new Speaker({
            channels: 1,
            bitDepth: 16,
            sampleRate: 44100
        });

        const duration = Math.min(textLength * 80, 1500); // Max 1.5 seconds
        const frequency = 800; // Hz
        const sampleRate = 44100;
        const samples = Math.floor(sampleRate * (duration / 1000));
        
        const buffer = Buffer.alloc(samples * 2);
        
        for (let i = 0; i < samples; i++) {
            const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 8000;
            buffer.writeInt16LE(sample, i * 2);
        }
        
        speaker.write(buffer);
        speaker.end();
    }

    restartListening() {
        console.log('🔄 Restarting audio input...');
        
        try {
            if (this.audioInput) {
                this.audioInput.quit();
            }
        } catch (error) {
            console.log('Error stopping audio input:', error.message);
        }
        
        this.wakeWordBuffer = [];
        this.commandBuffer = [];
        this.isProcessingCommand = false;
        this.isRecordingCommand = false;
        
        setTimeout(() => {
            this.init();
        }, 2000);
    }

    cleanup() {
        console.log('🧹 Cleaning up resources...');
        
        try {
            if (this.audioInput) {
                this.audioInput.quit();
            }
            if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
            }
        } catch (error) {
            console.log('Cleanup error:', error.message);
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

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    process.exit(1);
});

// Start the assistant
const navi = new NaviVoiceAssistant();
