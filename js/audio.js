// js/audio.js

export class AudioEngine {
    // attribute initialization for wind sound synthesis and sampled tracks
    constructor() {
        // create audio context and master source node
        this.ctx = new window.AudioContext()
        this.source = null

        // soundtrack registry
        this.trackNames = ['rain', 'thunder', 'birds', 'crickets', 'waterfall']
        this.tracks = {}
        
        // setup wind synthesis nodes and sampled track nodes
        this.setupWindSynthesis()
        this.setupSampledTracks()

        // Start loading samples immediately
        this.loadAssets()
    }

    // set up the audio node graph for the synthesized wind sound
    setupWindSynthesis() {
        // Master volume for the synthesized noise
        this.masterGain = this.ctx.createGain()
        this.masterGain.gain.value = 0

        // separate gain nodes for low and high filtered noise
        this.lowFilterGain = this.ctx.createGain()
        this.lowFilterGain.gain.value = 0.1
        this.highFilterGain = this.ctx.createGain()
        this.highFilterGain.gain.value = 0.1

        // low filter for the thrumming base of the wind
        this.lowFilter = this.ctx.createBiquadFilter()
        this.lowFilter.type = 'lowpass'
        this.lowFilter.frequency.value = 400

        // high filter for the whistling and gusting elements of the wind
        this.highFilter = this.ctx.createBiquadFilter()
        this.highFilter.type = 'bandpass'
        this.highFilter.frequency.value = 800
        this.highFilter.Q.value = 3

        // low frequency oscillator makes the wind whistle
        this.highFilterLFO = this.ctx.createOscillator()
        this.highFilterLFO.type = 'sine'
        this.highFilterLFO.frequency.value = 0.2
        
        this.highFilterMod = this.ctx.createGain()
        this.highFilterMod.gain.value = 0

        // LFO -> Modulator -> High Filter Frequency
        this.highFilterLFO.connect(this.highFilterMod)
        this.highFilterMod.connect(this.highFilter.frequency)

        // Noise (created in startNoise) -> Filters -> Master -> Speakers/Headphones
        this.highFilter.connect(this.highFilterGain)
        this.lowFilter.connect(this.lowFilterGain)
        this.highFilterGain.connect(this.masterGain)
        this.lowFilterGain.connect(this.masterGain)
        this.masterGain.connect(this.ctx.destination)
        
        this.highFilterLFO.start()
    }

    // set up the audio node graph for the sampled tracks
    setupSampledTracks() {
        this.trackNames.forEach(name => {
            this.tracks[name] = {
                gain: this.ctx.createGain(),
                buffer: null,
                source: null
            }
            this.tracks[name].gain.gain.value = 0
            this.tracks[name].gain.connect(this.ctx.destination)
        })
    }

    // create base white noise and start playback
    startNoise = () => {
        // prevent multiple calls from layering noise sources on top of each other
        if (this.source) return

        // account for if browser blocks audio at first
        if (this.ctx.state === 'suspended') this.ctx.resume()

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

    // load audio files for sampled tracks and decode them for playback
    async loadAssets() {
        const load = async (name) => {
            try {
                const res = await fetch(`assets/audio/${name}.mp3`)
                const arrayBuffer = await res.arrayBuffer()
                this.tracks[name].buffer = await this.ctx.decodeAudioData(arrayBuffer)
            } catch (e) {
                console.error(`Failed to load ${name}:`, e)
            }
        }

        await Promise.all(this.trackNames.map(name => load(name)))
    }

    // start all sampled tracks (silent until gain is adjusted)
    startAllLoops = () => {
        if (this.ctx.state === 'suspended') this.ctx.resume()

        this.trackNames.forEach(name => {
            const track = this.tracks[name]

            // if source already exists or buffer isn't loaded yet, skip
            if (track.source || !track.buffer) return

            track.source = this.ctx.createBufferSource()
            track.source.buffer = track.buffer
            track.source.loop = true
            track.source.connect(track.gain)
            track.source.start()
        })
    }
    
    // unified volume control for both synthesized and sampled sounds
    setVolume(name, value) {
        const targetGain = (name === 'wind') ? this.masterGain.gain : this.tracks[name].gain.gain
        if (targetGain) {
            targetGain.linearRampToValueAtTime(value, this.ctx.currentTime + 0.05)
        }
    }

    // change the sound based on weather
    updateEnvironment = (weather) => {
        const isRainy = weather.condition === 'Rain'
        const now = this.ctx.currentTime
        const duration = 4 // seconds for transition
        
        const config = isRainy ? {
            // rain and thunder fade in, wind gains intensity, birds and crickets fade out
            volumes: { rain: 0.25, thunder: 0.07, birds: 0, crickets: 0, waterfall: 0, wind: 0.35 },
            lowFreq: 150,
            lowGain: 0.010,
            highFreq: 500,
            highGain: 0.08,
            modGain: 0,
            windQ: 0.5
        } : {
            // rain and thunder fade out, wind calms down, birds fade in
            volumes: { rain: 0, thunder: 0, birds: 0.3, crickets: 0, waterfall: 0, wind: 0.5 },
            lowFreq: 200,
            lowGain: 0.010,
            highFreq: 380,
            highGain: 0.3,
            modGain: 80,
            windQ: 12
        }

        // sync Audio and UI Sliders simultaneously
        Object.entries(config.volumes).forEach(([name, vol]) => {
            this.setVolume(name, vol)
            const slider = document.querySelector(`#${name}Volume`)
            if (slider) slider.value = vol
        })

        // apply filter/modulator changes with smooth transitions
        this.lowFilter.frequency.exponentialRampToValueAtTime(config.lowFreq, now + duration)
        this.highFilter.frequency.exponentialRampToValueAtTime(config.highFreq, now + duration)
        this.highFilterMod.gain.linearRampToValueAtTime(config.modGain, now + duration)
        this.highFilter.Q.linearRampToValueAtTime(config.windQ, now + duration)
        this.lowFilterGain.gain.linearRampToValueAtTime(config.lowGain, now + duration)
        this.highFilterGain.gain.linearRampToValueAtTime(config.highGain, now + duration)
    }
}