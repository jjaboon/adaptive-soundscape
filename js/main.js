// main.js

import { AudioEngine } from './audio.js'
import { WeatherService } from './weather-api.js'

const audio = new AudioEngine()
const weather = new WeatherService()

// Landing page elements
const title = document.querySelector('#title')
const headphones = document.querySelector('#headphones')

// UI elements
const startBtn = document.querySelector('#start-btn')
const infoGrid = document.querySelector('#info-grid')
const loader = document.querySelector('#loader')
const weatherToggle = document.querySelector('#weatherToggle');
const weatherLabel = document.querySelector('#weatherLabel');

// Slider elements
const rainSlider = document.querySelector('#rainVolume')
const thunderSlider = document.querySelector('#thunderVolume')
const birdsSlider = document.querySelector('#birdsVolume')

// rain animation interval for rain bg
let rainInterval = null

// The event listener must be 'async' to use 'await'
startBtn.addEventListener('click', async () => {
    // remove title and headphones recommendation on first click
    title.classList.add('d-none')
    headphones.classList.add('d-none')

    // show loader and disable button while we fetch weather data
    loader.classList.remove('d-none')
    startBtn.disabled = true
    startBtn.textContent = 'Syncing Weather...'

    // start audio engine
    audio.startNoise()
    audio.startAllLoops() // silent until gain is adjusted

    // clear any existing rain animation
    if (rainInterval) {
        clearInterval(rainInterval);
        rainInterval = null;
    }
    // fetch the current weather condition
    const weatherData = await weather.fetchCurrentWeather()
    
    // update switch UI based on fetched weather condition
    const isRainy = weatherData.condition === 'Rain'
    weatherToggle.checked = isRainy
    weatherLabel.textContent = isRainy ? 'Mode: Rainy' : 'Mode: Clear'

    if (weatherData.condition === 'Rain') {
        // Smoothly shift gradient to stormy colors
        document.body.style.setProperty('--grad-top', '#485563')
        document.body.style.setProperty('--grad-bottom', '#29323c')

        // start rain animation
        rainInterval = setInterval(createRaindrop, 50);
    } else {
        // Smoothly shift gradient to clear sky colors
        document.body.style.setProperty('--grad-top', '#67f7ff')
        document.body.style.setProperty('--grad-bottom', '#67ccff')

        // stop rain animation if it was running
        if (rainInterval) {
            clearInterval(rainInterval);
            rainInterval = null;
        }
    }

    console.log("Applying weather logic:", weatherData.condition)

    // update the audio environment based on the fetched weather condition
    audio.updateEnvironment(weatherData)

    // reveal the info grid with a fade-in effect
    infoGrid.classList.remove('grid-hidden')
    setTimeout(() => {
        infoGrid.classList.add('grid-show')
    }, 10);

    // hide loader and re-enable button after everything is set up
    loader.classList.add('d-none')
    startBtn.disabled = false
    startBtn.textContent = 'Resync Weather'
})

// manual slider overrides
rainSlider.addEventListener('input', (e) => {
    audio.setRainVolume(e.target.value)
})

thunderSlider.addEventListener('input', (e) => {
    audio.setThunderVolume(e.target.value)
})

birdsSlider.addEventListener('input', (e) => {
    audio.setBirdsVolume(e.target.value)
})

// rain animation logic
const createRaindrop = () => {
    const raindrop = document.createElement('div');
    raindrop.classList.add('raindrop');

    raindrop.style.left = Math.random() * window.innerWidth + 'px';

    const duration = Math.random() * 1 + 0.5;
    raindrop.style.animationDuration = duration + 's';

    document.body.appendChild(raindrop);

    setTimeout(() => {
        raindrop.remove();
    }, duration * 1000);
}

// manual weather toggle for user control
weatherToggle.addEventListener('change', (e) => {
    // Determine state based on toggle
    const isRainy = e.target.checked;
    const manualData = { condition: isRainy ? 'Rain' : 'Clear' };
    weatherLabel.textContent = isRainy ? 'Mode: Rainy' : 'Mode: Clear';

    // 1. Update Audio
    audio.updateEnvironment(manualData);

    // 2. Update Background Colors
    if (manualData.condition === 'Rain') {
        // Smoothly shift gradient to stormy colors
        document.body.style.setProperty('--grad-top', '#485563')
        document.body.style.setProperty('--grad-bottom', '#29323c')

        // start rain animation
        rainInterval = setInterval(createRaindrop, 50);
    } else {
        // Smoothly shift gradient to clear sky colors
        document.body.style.setProperty('--grad-top', '#67f7ff')
        document.body.style.setProperty('--grad-bottom', '#67ccff')

        // stop rain animation if it was running
        if (rainInterval) {
            clearInterval(rainInterval);
            rainInterval = null;
        }
    }
});