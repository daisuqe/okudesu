"""Generate bgm_gameover.wav (anti-aliased version).
Same score as the Unity gen_gameover.py, but square waves are band-limited
with PolyBLEP and the mix gets a gentle low-pass, removing the gritty aliasing."""
import struct, math, wave, os

SAMPLE_RATE = 44100

def write_wav(filename, samples):
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        for s in samples:
            clamped = max(-1.0, min(1.0, s))
            f.writeframesraw(struct.pack('<h', int(clamped * 32767)))
    print(f"Written: {filename}")

def note_freq(note):
    names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    aliases = {'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B'}
    n = note[:-1]; octave = int(note[-1])
    n = aliases.get(n, n)
    semitone = names.index(n) + (octave + 1) * 12
    return 440.0 * (2.0 ** ((semitone - 69) / 12.0))

def square_naive(t, freq, duty=0.5):
    if freq == 0: return 0.0
    return 1.0 if (t * freq) % 1.0 < duty else -1.0

def _blep(t, dt):
    if t < dt:
        t /= dt
        return t + t - t * t - 1.0
    if t > 1.0 - dt:
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    return 0.0

def square(t, freq, duty=0.5):
    if freq == 0: return 0.0
    dt = freq / SAMPLE_RATE
    ph = (t * freq) % 1.0
    v = 1.0 if ph < duty else -1.0
    v += _blep(ph, dt)
    v -= _blep((ph - duty) % 1.0, dt)
    return v

def triangle(t, freq):
    if freq == 0: return 0.0
    phase = (t * freq) % 1.0
    return 1.0 - 4.0 * abs(phase - 0.5)

def env(t_in_note, note_dur, a=0.01, d=0.08, s=0.55, r=0.15):
    if t_in_note < a:
        return t_in_note / a
    elif t_in_note < a + d:
        return 1.0 - (1.0 - s) * (t_in_note - a) / d
    elif t_in_note < note_dur - r:
        return s
    elif t_in_note < note_dur:
        return s * (1.0 - (t_in_note - (note_dur - r)) / r)
    return 0.0

def make_gameover():
    bpm = 72  # ゆっくり、重く
    beat_sec = 60.0 / bpm

    # Dマイナー下降進行 - 悲しい・終わりの感じ
    # ループしても自然なようにフェードなし
    melody = [
        ('D5', 2), ('C5', 1), ('Bb4', 1),
        ('A4', 2), ('G4', 1), ('F4', 1),
        ('E4', 1.5), ('F4', 0.5), ('G4', 1), ('A4', 1),
        ('D4', 3), (None, 1),
        ('F4', 1.5), ('E4', 0.5), ('D4', 1), ('C4', 1),
        ('Bb3', 2), ('A3', 2),
        ('G3', 1), ('A3', 1), ('Bb3', 1), ('C4', 1),
        ('D4', 3.5), (None, 0.5),
    ]
    bass = [
        ('D2', 2), ('C2', 2),
        ('Bb1', 2), ('A1', 2),
        ('G1', 2), ('F1', 2),
        ('D1', 4),
        ('Bb1', 2), ('A1', 2),
        ('G1', 2), ('F1', 2),
        ('E1', 2), ('A1', 2),
        ('D1', 4),
    ]
    chord = [
        ('D3', 2), ('C3', 2),
        ('Bb2', 2), ('A2', 2),
        ('G2', 2), ('F2', 2),
        ('D2', 4),
        ('Bb2', 2), ('A2', 2),
        ('G2', 2), ('F2', 2),
        ('E2', 2), ('A2', 2),
        ('D2', 4),
    ]

    total_beats = 32
    total_sec = total_beats * beat_sec
    n_samples = int(total_sec * SAMPLE_RATE)
    out = [0.0] * n_samples

    def render(seq, vol, wfn, duty=0.5):
        t_abs = 0.0; idx = 0
        while t_abs < total_sec:
            name, beats = seq[idx % len(seq)]
            note_sec = beats * beat_sec
            note_samp = int(note_sec * SAMPLE_RATE)
            start = int(t_abs * SAMPLE_RATE)
            freq = note_freq(name) if name else 0.0
            for j in range(note_samp):
                s = start + j
                if s >= n_samples: break
                t_in = j / SAMPLE_RATE
                e = env(t_in, note_sec)
                tg = t_abs + t_in
                w = square(tg, freq, duty) if wfn == 'sq' else triangle(tg, freq)
                out[s] += w * e * vol
            t_abs += note_sec; idx += 1

    render(melody, 0.22, 'sq', 0.2)   # リード: 細い矩形波で儚い感じ
    render(bass,   0.18, 'sq', 0.4)   # ベース
    render(chord,  0.10, 'tri')        # コード: トライアングル波で暖かく

    # 全体を少し暗くするためマスターボリューム0.75倍
    # gentle one-pole low-pass (~5 kHz) to soften the remaining edge
    a = math.exp(-2.0 * math.pi * 5000.0 / SAMPLE_RATE)
    y = 0.0
    res = []
    for x in out:
        y = (1.0 - a) * x + a * y
        res.append(y * 0.75)
    return res

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'audio')
write_wav(os.path.join(out_dir, 'bgm_gameover.wav'), make_gameover())
print("Done")
