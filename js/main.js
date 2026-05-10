// main.js

import { AudioEngine } from './audio.js'
import { WeatherService } from './weather-api.js'

const audio = new AudioEngine()
const weather = new WeatherService()

// DOM elements grouped for easier access
const ui = {
    title: document.querySelector('#title'),
    headphones: document.querySelector('#headphones'),
    startBtn: document.querySelector('#start-btn'),
    infoGrid: document.querySelector('#info-grid'),
    loader: document.querySelector('#loader'),
    toggle: document.querySelector('#weatherToggle'),
    label: document.querySelector('#weatherLabel')
}

// Slider elements mapped by track name for easier access
const sliderIds = ['rain', 'thunder', 'birds', 'wind', 'crickets', 'waterfall']
let rainInterval = null

// helper function to update background colors and manage rain animation
const updateVisuals = (condition) => {
    const isRainy = condition === 'Rain'
    
    // update bg colors
    const colors = isRainy 
        ? { top: '#485563', bottom: '#29323c' } 
        : { top: '#67f7ff', bottom: '#67ccff' }

    document.body.style.setProperty('--grad-top', colors.top)
    document.body.style.setProperty('--grad-bottom', colors.bottom)

    // manage rain animation
    if (isRainy && !rainInterval) {
        rainInterval = setInterval(createRaindrop, 50)
    } else if (!isRainy && rainInterval) {
        clearInterval(rainInterval)
        rainInterval = null
    }
}

// handle start/resync button click
ui.startBtn.addEventListener('click', async () => {
    ui.title.classList.add('d-none')
    ui.headphones.classList.add('d-none')
    ui.loader.classList.remove('d-none')
    ui.startBtn.disabled = true
    ui.startBtn.textContent = 'Syncing Weather...'

    // start audio engine
    audio.startNoise()
    audio.startAllLoops()

    // fetch the current weather condition
    const weatherData = await weather.fetchCurrentWeather()
    
    // update switch UI based on fetched weather condition
    const isRainy = weatherData.condition === 'Rain'
    ui.toggle.checked = isRainy
    ui.label.textContent = isRainy ? 'Mode: Rainy' : 'Mode: Clear'

    updateVisuals(weatherData.condition)
    audio.updateEnvironment(weatherData)

    // reveal the info grid with a fade-in effect
    ui.infoGrid.classList.remove('grid-hidden')
    setTimeout(() => {
        ui.infoGrid.classList.add('grid-show')
    }, 10)

    // hide loader and re-enable button after everything is set up
    ui.loader.classList.add('d-none')
    ui.startBtn.disabled = false
    ui.startBtn.textContent = 'Resync Weather'
})

sliderIds.forEach(id => {
    const slider = document.querySelector(`#${id}Volume`)
    if (slider) {
        slider.addEventListener('input', (e) => {
            audio.setVolume(id, e.target.value)
        })
    }
})

// rain animation logic
const createRaindrop = () => {
    const raindrop = document.createElement('div')
    raindrop.classList.add('raindrop')

    raindrop.style.left = Math.random() * window.innerWidth + 'px'

    const duration = Math.random() * 1 + 0.5
    raindrop.style.animationDuration = duration + 's'

    document.body.appendChild(raindrop)

    setTimeout(() => {
        raindrop.remove()
    }, duration * 1000)
}

// manual weather toggle for user control
ui.toggle.addEventListener('change', (e) => {
    // Determine state based on toggle
    const isRainy = e.target.checked
    const manualData = { condition: isRainy ? 'Rain' : 'Clear' }
    ui.label.textContent = isRainy ? 'Mode: Rainy' : 'Mode: Clear'

    // Update audio and environment
    audio.updateEnvironment(manualData)
    updateVisuals(manualData.condition)
})