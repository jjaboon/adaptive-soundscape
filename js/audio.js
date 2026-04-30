// js/audio.js

export class AudioEngine {
    constructor() {
        // attribute initialization for wind sound synthesis
        this.ctx = new window.AudioContext()
        this.source = null
        this.masterGain = this.ctx.createGain()
        this.lowFilterGain = this.ctx.createGain()
        this.highFilterGain = this.ctx.createGain()
        this.lowFilter = this.ctx.createBiquadFilter()
        this.highFilter = this.ctx.createBiquadFilter()
        this.highFilterLFO = this.ctx.createOscillator()
        this.highFilterMod = this.ctx.createGain()

        // attribute initialization for audio assets
        this.thunderGain = this.ctx.createGain()
        this.birdsGain = this.ctx.createGain()
        this.rainGain = this.ctx.createGain()

        const assetGains = [this.thunderGain, this.birdsGain, this.rainGain];

       assetGains.forEach(g => {
            g.gain.value = 0;
            g.connect(this.ctx.destination)
        });
        
        this.rainBuffer = null
        this.thunderBuffer = null
        this.birdsBuffer = null

        this.sources = {
            rain: null,
            thunder: null,
            birds: null
        };
        this.loadAssets() // start loading audio assets immediately

        // setup master gain (overall volume control)
        this.masterGain.gain.value = 0 // start silent

        // setup low filter
        this.lowFilter.type = 'lowpass'
        this.lowFilter.frequency.value = 400 // hz
        this.lowFilterGain.gain.value = 0.1

        // setup high filter
        this.highFilter.type = 'bandpass'
        this.highFilter.frequency.value = 800
        this.highFilterGain.gain.value = 0.1
        this.highFilter.Q.value = 3

        // setup low frequency oscillator (LFO) for wind variation
        this.highFilterLFO.type = 'sine'
        this.highFilterLFO.frequency.value = 0.2 // oscillation rate
        this.highFilterMod.gain.value = 0 // initially no oscillation

        // connect LFO to high filter frequency
        this.highFilterLFO.connect(this.highFilterMod)
        this.highFilterMod.connect(this.highFilter.frequency)

        // 2-layer filtered noise -> masterGain (volume control) -> destination (speaker/headphone)
        this.lowFilter.connect(this.lowFilterGain)
        this.lowFilterGain.connect(this.masterGain)
        this.highFilter.connect(this.highFilterGain)
        this.highFilterGain.connect(this.masterGain)
        this.masterGain.connect(this.ctx.destination)

        this.highFilterLFO.start()
    }

    // create base white noise and start playback
    startNoise = () => {
        // prevent multiple calls from layering noise sources on top of each other
        if (this.source) {
        console.log("Audio is already playing.")
        return; 
        }

        // account for if browser blocks audio at first
        if (this.ctx.state === 'suspended') {
            this.ctx.resume()
        }

        // allocate memory for sound
        const bufferSize = 2 * this.ctx.sampleRate // around 2 sec
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
        
        // create reference to bits of audio channel
        const output = this.noiseBuffer.getChannelData(0)

        // fill buffer with random values to simulate static (wind)
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1
        }

        // set up audio playback
        this.source = this.ctx.createBufferSource()
        this.source.buffer = this.noiseBuffer
        this.source.loop = true
        
        this.source.connect(this.lowFilter)
        this.source.connect(this.highFilter)
        this.source.start()

        // fade in volume
        this.masterGain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 2)
    }

    async loadAssets() {
        // Helper to load multiple files efficiently
        const load = async (path) => {
            const response = await fetch(path);
            return await this.ctx.decodeAudioData(await response.arrayBuffer())
        }

        try {
            this.rainBuffer = await load('assets/audio/raindrops.mp3')
            this.thunderBuffer = await load('assets/audio/thunder.mp3')
            this.birdsBuffer = await load('assets/audio/birds.mp3')
        } catch (e) {
            console.error("Audio Load Error:", e) 
        }
    }

    startAllLoops = () => {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume()
        }

        // If the rain source already exists, we assume everything is already looping.
        if (this.sources.rain) {
            console.log("Loops are already active.")
            return; 
        }

        const audioConfig = [
            { name: 'rain', buffer: this.rainBuffer, gain: this.rainGain },
            { name: 'thunder', buffer: this.thunderBuffer, gain: this.thunderGain },
            { name: 'birds', buffer: this.birdsBuffer, gain: this.birdsGain }
        ];

        audioConfig.forEach(item => {
            const src = this.ctx.createBufferSource()
            src.buffer = item.buffer
            src.loop = true
            src.connect(item.gain)
            src.start()

            // Store the reference so we know it's running
            this.sources[item.name] = src;
        })
    }

    // smoothly adjust asset volume via volume slider
    setRainVolume = (v) => {this.rainGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.05)}
    setThunderVolume = (v) => this.thunderGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.05)
    setBirdsVolume = (v) => this.birdsGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.05)

    // change the sound based on weather
    updateEnvironment = (weather) => {
        const now = this.ctx.currentTime;
        const duration = 4; // seconds for transition
        if (weather.condition === 'Rain') {
            this.rainGain.gain.linearRampToValueAtTime(0.15, now + 0.05)
            this.thunderGain.gain.linearRampToValueAtTime(0.07, now + 0.05)
            this.birdsGain.gain.linearRampToValueAtTime(0, now + 0.05)
            
            // Sync UI Sliders
            this.updateSliders(0.15, 0.07, 0);

            // muffle lower thrumming
            this.lowFilterGain.gain.linearRampToValueAtTime(0.010, now + duration)
            this.lowFilter.frequency.exponentialRampToValueAtTime(150, now + duration)

            // increase higher pattering to mimic heavy rain
            this.highFilter.frequency.exponentialRampToValueAtTime(500, now + duration)
            this.highFilterGain.gain.linearRampToValueAtTime(0.08, now + duration)
            this.highFilter.Q.linearRampToValueAtTime(0.5, now + duration)

            // turn off wind oscillations
            this.highFilterMod.gain.linearRampToValueAtTime(0, now + duration)
        } else {
            // fade out raindrops/thunder and fade in birds
            this.rainGain.gain.linearRampToValueAtTime(0, now + 0.05)
            this.thunderGain.gain.linearRampToValueAtTime(0, now + 0.05)
            this.birdsGain.gain.linearRampToValueAtTime(0.3, now + 0.05)

            // Sync UI Sliders
            this.updateSliders(0, 0, 0.3);

            // bring back clear wind
            this.lowFilterGain.gain.linearRampToValueAtTime(0.01, now + duration)
            this.lowFilter.frequency.exponentialRampToValueAtTime(5, now + duration)
            this.highFilter.frequency.exponentialRampToValueAtTime(380, now + duration)
            this.highFilterGain.gain.linearRampToValueAtTime(0.3, now + duration)
            this.highFilter.Q.linearRampToValueAtTime(12, now + duration)

            // bring back wind oscillations
            this.highFilterMod.gain.linearRampToValueAtTime(80, now + duration)
            this.highFilterLFO.frequency.linearRampToValueAtTime(0.25, now + duration)
        }
    }

    updateSliders = (r, t, b) => {
        const rS = document.querySelector('#rainVolume');
        const tS = document.querySelector('#thunderVolume');
        const bS = document.querySelector('#birdsVolume');
        // prevent slider update if (somehow) element is missing
        if (rS) rS.value = r;
        if (tS) tS.value = t;
        if (bS) bS.value = b;
    }
}