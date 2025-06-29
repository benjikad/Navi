import sounddevice as sd
import numpy as np
from scipy.io.wavfile import write
from faster_whisper import WhisperModel
import webrtcvad
from datetime import datetime
import os
import time
import collections
import sys
import math
import random
import threading
import queue
import pyttsx3  # For TTS
import subprocess  # For running system commands

# === SETTINGS ===
CHUNK_DURATION = 0.1  # 100ms chunks for responsive detection
SAMPLE_RATE = 16000
CHANNELS = 1
MODEL_SIZE = "small"  # Back to small for faster processing
VAD_MODE = 3
PRE_SPEECH_BUFFER_MS = 500  # 500ms before speech detection
POST_SPEECH_SILENCE_MS = 500  # 500ms of silence to capture after speech ends

# === LOAD MODEL ===
print("Loading FasterWhisper model...")
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
print("Model loaded.")

# === SETUP VAD ===
vad = webrtcvad.Vad()
vad.set_mode(VAD_MODE)

# === AUDIO PROCESSING CLASS ===
class ContinuousSpeechDetector:
    def __init__(self):
        self.chunk_size = int(CHUNK_DURATION * SAMPLE_RATE)
        self.pre_buffer_chunks = int(PRE_SPEECH_BUFFER_MS / (CHUNK_DURATION * 1000))
        self.post_silence_chunks = int(POST_SPEECH_SILENCE_MS / (CHUNK_DURATION * 1000))
        
        # Circular buffer for pre-speech audio
        self.pre_buffer = collections.deque(maxlen=self.pre_buffer_chunks)
        
        # Current speech recording
        self.speech_chunks = []
        self.is_recording = False
        self.silence_counter = 0
        
        # Audio queue for processing
        self.audio_queue = queue.Queue()
        self.running = True
        
        # TTS queue and thread - using SimpleQueue instead
        self.tts_queue = queue.SimpleQueue()
        self.tts_thread = threading.Thread(target=self._tts_worker, daemon=True)
        self.tts_thread.start()
        
        # Start audio processing thread
        self.audio_thread = threading.Thread(target=self._audio_processor, daemon=True)
        self.audio_thread.start()
    
    def _is_speech_chunk(self, audio_chunk):
        """Check if audio chunk contains speech using VAD"""
        # Convert to bytes for VAD
        audio_bytes = (audio_chunk * 32767).astype(np.int16).tobytes()
        
        # Check amplitude threshold
        max_amp = abs(audio_chunk * 32767).max()
        if max_amp < 450:
            return False
        
        # Use VAD for 30ms frames
        frame_duration_ms = 30
        frame_size = int(SAMPLE_RATE * frame_duration_ms / 1000) * 2  # 2 bytes per sample
        
        speech_frames = 0
        total_frames = 0
        
        for i in range(0, len(audio_bytes) - frame_size, frame_size):
            frame = audio_bytes[i:i + frame_size]
            if len(frame) == frame_size:
                try:
                    if vad.is_speech(frame, SAMPLE_RATE):
                        speech_frames += 1
                    total_frames += 1
                except:
                    continue
        
        # Consider it speech if >50% of frames are speech
        return total_frames > 0 and (speech_frames / total_frames) > 0.5
    
    def _audio_processor(self):
        """Background thread that processes audio chunks"""
        while self.running:
            try:
                # Record a chunk
                audio_chunk = sd.rec(self.chunk_size, samplerate=SAMPLE_RATE, 
                                   channels=CHANNELS, dtype='float32')
                sd.wait()
                audio_chunk = audio_chunk.flatten()
                
                is_speech = self._is_speech_chunk(audio_chunk)
                
                if not self.is_recording:
                    # Add to pre-buffer
                    self.pre_buffer.append(audio_chunk)
                    
                    if is_speech:
                        # Speech detected! Start recording
                        print("Speech detected - starting recording...")
                        self.is_recording = True
                        self.silence_counter = 0
                        
                        # Add pre-buffer to speech recording
                        self.speech_chunks = list(self.pre_buffer)
                        self.speech_chunks.append(audio_chunk)
                else:
                    # Currently recording
                    self.speech_chunks.append(audio_chunk)
                    
                    if is_speech:
                        # Reset silence counter
                        self.silence_counter = 0
                    else:
                        # Increment silence counter
                        self.silence_counter += 1
                        
                        if self.silence_counter >= self.post_silence_chunks:
                            # End of speech detected - but keep recording the silence
                            print("End of speech detected - processing...")
                            self._process_speech()
                            self._reset_recording()
                
            except Exception as e:
                print(f"Audio processing error: {e}")
                time.sleep(0.1)
    
    def _process_speech(self):
        """Process the captured speech"""
        if not self.speech_chunks:
            return
        
        # Combine all chunks
        full_audio = np.concatenate(self.speech_chunks)
        
        print(f"Processing {len(full_audio)/SAMPLE_RATE:.2f}s of audio...")
        
        try:
            # Transcribe
            segments, _ = model.transcribe(full_audio, language="en")
            
            for seg in segments:
                text = seg.text.strip()
                if text:
                    print(f"Transcribed: {text}")
                    self._handle_command(text)
        
        except Exception as e:
            print(f"Transcription error: {e}")
    
    def _reset_recording(self):
        """Reset recording state"""
        self.is_recording = False
        self.speech_chunks = []
        self.silence_counter = 0
    
    def _tts_worker(self):
        """Background thread that handles all TTS requests - creates new engine for each request"""
        print("TTS worker started")
        
        while self.running:
            try:
                # Get text from queue
                text = self.tts_queue.get()
                if text is None:  # Shutdown signal
                    print("TTS worker received shutdown signal")
                    break
                
                print(f"TTS: Processing: '{text}'")
                
                # Create a fresh engine for each request to avoid "run loop already started"
                engine = None
                try:
                    engine = pyttsx3.init()
                    
                    # Set properties
                    voices = engine.getProperty('voices')
                    if voices:
                        engine.setProperty('voice', voices[0].id)
                    engine.setProperty('rate', 150)
                    engine.setProperty('volume', 0.8)
                    
                    # Speak the text
                    engine.say(text)
                    engine.runAndWait()
                    
                    print(f"TTS: Completed: '{text}'")
                    
                except Exception as tts_error:
                    print(f"TTS engine error: {tts_error}")
                    
                finally:
                    # Always clean up the engine
                    if engine:
                        try:
                            engine.stop()
                            del engine
                        except:
                            pass
                
            except Exception as e:
                print(f"TTS worker error: {e}")
                time.sleep(0.1)
        
        print("TTS worker stopping")
    
    def _speak(self, text):
        """Queue text for speech"""
        print(f"TTS: Queuing text: '{text}'")
        try:
            self.tts_queue.put(text)
            print(f"TTS: Text queued successfully")
        except Exception as e:
            print(f"TTS: Failed to queue text: {e}")
    
    def _handle_command(self, text):
        """Handle voice commands"""
        text_lower = text.lower().strip().replace(",", "")
        
        if text_lower.startswith('hey navi'):
            global activated
            activated = True
            self._speak('Yes?')
            return
        
        if activated:
            activated = False

            if text_lower.startswith("stop") or text_lower.startswith("never mind") or text_lower.startswith("nevermind"):
                self._speak(random.randint(1,2)==1 and 'Okay.' or 'Got it.')
            
            elif text_lower.startswith("flip a coin") or text_lower.startswith("flipacoin"):
                heads = random.randint(1,2)==1 and 'heads' or 'tails'
                self._speak(f"It's {heads}!")
            
            elif text_lower.startswith("how are you"):
                self._speak("I'm doing good, thanks for asking!")
            
            elif text_lower.startswith("restart discord"):
                self._speak("Restarting Discord...")
                self._restart_discord()
            
            elif "what time is it" in text_lower or text_lower.startswith("time"):
                current_time = datetime.now()
                hour = current_time.hour
                minute = current_time.minute
                
                # Convert to 12-hour format
                if hour == 0:
                    hour_12 = 12
                    am_pm = "AM"
                elif hour < 12:
                    hour_12 = hour
                    am_pm = "AM"
                elif hour == 12:
                    hour_12 = 12
                    am_pm = "PM"
                else:
                    hour_12 = hour - 12
                    am_pm = "PM"
                
                # Determine time of day
                if 5 <= current_time.hour < 12:
                    time_of_day = "morning"
                elif 12 <= current_time.hour < 17:
                    time_of_day = "afternoon"
                else:
                    time_of_day = "evening"
                
                # Format the time string
                if minute == 0:
                    time_str = f"It is {hour_12} {am_pm} in the {time_of_day}"
                else:
                    minute_str = f"{minute:02d}"  # Pad with zero if needed
                    time_str = f"It is {hour_12}:{minute_str} {am_pm} in the {time_of_day}"
                
                self._speak(time_str)
            
            elif text_lower.startswith("exit") or text_lower.startswith("kill yourself"):
                global ended
                ended = True
                self._speak('Good bye.')
                self.stop()
            else:
                self._speak('Unknown command.')
    
    def _restart_discord(self):
        """Restart Discord by killing the process and reopening it"""
        try:
            print("Attempting to restart Discord...")
            
            # Kill Discord process
            subprocess.run(['taskkill', '/F', '/IM', 'Discord.exe'], 
                         capture_output=True, text=True)
            print("Discord process killed")
            
            # Wait a moment for cleanup
            time.sleep(2)
            
            # Common Discord installation paths
            discord_paths = [
                os.path.expanduser("~\\AppData\\Local\\Discord\\Update.exe"),
                os.path.expanduser("~\\AppData\\Roaming\\Discord\\Update.exe"),
                "C:\\Users\\%USERNAME%\\AppData\\Local\\Discord\\Update.exe",
                "C:\\Program Files\\Discord\\Discord.exe",
                "C:\\Program Files (x86)\\Discord\\Discord.exe"
            ]
            
            # Try to start Discord
            discord_started = False
            for path in discord_paths:
                expanded_path = os.path.expandvars(path)
                if os.path.exists(expanded_path):
                    try:
                        if "Update.exe" in path:
                            # Use Discord's updater to start properly
                            subprocess.Popen([expanded_path, '--processStart', 'Discord.exe'], 
                                           stdout=subprocess.DEVNULL, 
                                           stderr=subprocess.DEVNULL)
                        else:
                            # Direct executable
                            subprocess.Popen([expanded_path], 
                                           stdout=subprocess.DEVNULL, 
                                           stderr=subprocess.DEVNULL)
                        
                        print(f"Discord started from: {expanded_path}")
                        discord_started = True
                        break
                    except Exception as e:
                        print(f"Failed to start Discord from {expanded_path}: {e}")
                        continue
            
            if not discord_started:
                print("Could not find Discord installation")
                self._speak("Discord not found. Please start it manually.")
            else:
                self._speak("Discord restarted successfully.")
                
        except Exception as e:
            print(f"Error restarting Discord: {e}")
            self._speak("Error restarting Discord.")
    
    def stop(self):
        """Stop the audio processor"""
        print("Stopping speech detector...")
        self.running = False
        
        # Signal TTS thread to stop
        self.tts_queue.put(None)
        
        # Wait for threads to finish
        if self.audio_thread.is_alive():
            print("Waiting for audio thread...")
            self.audio_thread.join(timeout=2.0)
        if self.tts_thread.is_alive():
            print("Waiting for TTS thread...")
            self.tts_thread.join(timeout=3.0)
        
        print("All threads stopped")

# === MAIN EXECUTION ===
ended = False
activated = False

print("Starting continuous speech monitoring...")
print("Say 'hey navi' to activate, then give commands.")
print("Press Ctrl+C to exit.")

detector = ContinuousSpeechDetector()

try:
    while not ended:
        time.sleep(0.1)  # Keep main thread alive
except KeyboardInterrupt:
    print("\nExiting on user interrupt.")
finally:
    detector.stop()
    print("Shutdown complete.")
