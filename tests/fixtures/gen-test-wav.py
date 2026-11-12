import math, struct, wave

sr = 44100
bpm = 128.0
dur = 8.0
n = int(sr * dur)
beat = 60.0 / bpm
data = bytearray()
for i in range(n):
    t = i / sr
    # golpe de bombo en cada beat (decaimiento exponencial) + tono de fondo
    tb = t % beat
    kick = math.sin(2 * math.pi * 55 * tb) * math.exp(-tb * 18)
    hat = 0.15 * math.sin(2 * math.pi * 6000 * t) * (math.exp(-((t % (beat / 2)) * 60)))
    tone = 0.08 * math.sin(2 * math.pi * 220 * t)
    v = max(-1.0, min(1.0, kick * 0.8 + hat + tone))
    data += struct.pack('<h', int(v * 32000))
with wave.open('test-128bpm.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(bytes(data))
print('test-128bpm.wav listo', bpm, 'BPM')
