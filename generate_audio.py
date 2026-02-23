import os
import json
import asyncio
import re

# `edge-tts` is required: pip install edge-tts
# The `edge-tts` library provides high quality Microsoft Edge TTS voices for free.
import edge_tts

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, 'audio')
DATA_FILES = [
    'data.js', 'data2.js', 'data3.js', 'data4.js', 'data5.js', 'data6.js'
]

# TTS Configuration
# We will use a natural-sounding English US female voice (e.g., Aria or Jenny)
VOICE = "en-US-AriaNeural"  
RATE = "+0%"  # Normal speed, can adjust to "-10%" if needed for learning
PITCH = "+0Hz"

def parse_sentences_from_js(filepath):
    """
    Parses a js file containing 'const NEW_SENTENCES = [...]' or 'const SENTENCES = [...]'
    and extracts id and en text.
    Uses regex to extract the object properties robustly.
    """
    sentences = []
    
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return sentences
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Extract blocks between { } that contain id and en
    # A simple regex to find objects with id, day, en, ko
    pattern = r'\{\s*id:\s*(\d+),\s*day:\s*(\d+),\s*en:\s*[\'"`](.*?)[\'"`],\s*ko:\s*[\'"`](.*?)[\'"`]\s*\}'
    matches = re.finditer(pattern, content, re.DOTALL)
    
    for match in matches:
        _id = int(match.group(1))
        en_text = match.group(3)
        sentences.append({'id': _id, 'en': en_text})
        
    return sentences

async def generate_single_audio(sentence, semaphore):
    """
    Generates an mp3 file for a single sentence using edge-tts.
    """
    _id = sentence['id']
    text = sentence['en']
    output_path = os.path.join(AUDIO_DIR, f"{_id}.mp3")
    
    # Skip if file already exists
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        return True
        
    async with semaphore:
        try:
            communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
            await communicate.save(output_path)
            print(f"Generated: {output_path} - '{text[:30]}...'")
            return True
        except Exception as e:
            print(f"Failed to generate ID {_id}: {str(e)}")
            return False

async def main():
    if not os.path.exists(AUDIO_DIR):
        os.makedirs(AUDIO_DIR)
        
    all_sentences = []
    
    print("Parsing JS files...")
    for js_file in DATA_FILES:
        filepath = os.path.join(BASE_DIR, js_file)
        extracted = parse_sentences_from_js(filepath)
        all_sentences.extend(extracted)
        print(f"Extracted {len(extracted)} sentences from {js_file}")
        
    if not all_sentences:
        print("No sentences found! Check parsing logic or file paths.")
        return
        
    print(f"Total sentences to process: {len(all_sentences)}")
    
    # Limit concurrent connections to avoid rate limiting
    semaphore = asyncio.Semaphore(10) 
    
    print("Generating audio files with Microsoft Edge TTS...")
    
    tasks = [generate_single_audio(s, semaphore) for s in all_sentences]
    results = await asyncio.gather(*tasks)
    
    success_count = sum(1 for r in results if r)
    print(f"\nFinished! Successfully generated {success_count}/{len(all_sentences)} audio files.")

if __name__ == "__main__":
    asyncio.run(main())
