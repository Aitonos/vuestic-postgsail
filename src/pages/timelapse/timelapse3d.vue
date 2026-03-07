<template>
  <div class="leaflet-map">
    <template v-if="apiError">
      <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ apiError }}</va-alert>
    </template>
    <va-inner-loading :loading="isBusy" class="flex w-full h-full">
      <div id="mapContainer" ref="mapContainer" class="w-full h-full"></div>

      <!-- Bottom Center: Player Controls + Distance + Timestamp -->
      <div class="map-control bottom-center">
        <div class="legend">
          <div class="top-row">
            <span class="distance">{{ currentDistance }}</span>
            <span class="player" @click="togglePlayPause">
              <i class="va-icon material-icons">{{ isPlaying ? 'pause' : 'play_arrow' }}</i>
            </span>
            <span class="recorder" :class="{ recording: isRecording }" @click="startRecording">
              <i class="va-icon record">●</i>
            </span>
          </div>
          <div class="bottom-row">
            <span class="datetime">{{ currentTimestamp }}</span>
          </div>
        </div>
      </div>

      <!-- Top Center: Trip Name + Notes (temporal visibility) -->
      <div class="map-control top-center" :style="{ display: notesDisplay }">
        <div v-show="showNoteOverlay" class="overlay">
          <div class="top-row">
            <span class="trip">{{ tripName }}</span>
          </div>
          <div class="bottom-row">
            <span class="note">{{ currentNote }}</span>
          </div>
        </div>
      </div>

      <!-- Top Right: Instruments Panel -->
      <div class="map-control top-right" :style="{ display: instrumentsDisplay }">
        <div class="instruments">
          <div class="speed">
            <span class="label">Speed</span>
            <span class="value">{{ currentSpeed }}</span>
          </div>
          <div class="wind">
            <span class="label">Wind</span>
            <span class="value">{{ currentWindSpeed }}</span>
          </div>
          <div class="awa">
            <span class="label">AWA</span>
            <span class="value">{{ currentAWA }}</span>
          </div>
        </div>
      </div>

      <!-- Bottom Right: Fullscreen Button -->
      <div class="map-control bottom-right">
        <button class="fullscreen-btn" @click="toggleFullscreen">
          <i class="va-icon material-icons">{{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}</i>
        </button>
      </div>

      <!-- Playback Speed Control (Bottom Left) -->
      <div class="map-control bottom-left">
        <div class="speed-control">
          <select v-model="playbackSpeed" class="speed-select">
            <option :value="0.25">0.25x</option>
            <option :value="0.5">0.5x</option>
            <option :value="1">1x</option>
            <option :value="2">2x</option>
            <option :value="4">4x</option>
            <option :value="8">8x</option>
          </select>
        </div>
      </div>
    </va-inner-loading>
  </div>
</template>

<script setup>
  import { onMounted, ref, onBeforeUnmount, computed, watch, nextTick } from 'vue'
  import maplibregl from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import { MapboxOverlay } from '@deck.gl/mapbox'
  import { PathLayer } from '@deck.gl/layers'
  import { ScenegraphLayer } from '@deck.gl/mesh-layers'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { setAppTitle } from '../../utils/app.js'
  import PostgSail from '../../services/api-client'
  import { distanceFormat } from '../../utils/distanceFormatter.js'
  import { dateFormatUTC } from '../../utils/dateFormatter.js'
  import { speedFormatKnots } from '../../utils/speedFormatter.js'
  import { useToast } from 'vuestic-ui'
  import { useVesselStore } from '../../stores/vessel-store'
  import { useGlobalStore } from '../../stores/global-store'
  import { storeToRefs } from 'pinia'

  const { isLoggedIn, publicVessel, publicTimelapse } = useGlobalStore()
  const GlobalStore = useGlobalStore()
  const { isSidebarMinimized } = storeToRefs(GlobalStore)
  const { vesselName, vesselType } = useVesselStore()
  const { t } = useI18n()
  const { init: initToast } = useToast()

  const route = useRoute()
  const isBusy = ref(false)
  const apiError = ref(null)
  const mapContainer = ref()
  const map = ref()
  const timelapse = ref()

  // Animation state
  const currentFrame = ref(0)
  const isPlaying = ref(false)
  const isRecording = ref(false)
  const playbackSpeed = ref(1)
  const isFullscreen = ref(false)
  const showNoteOverlay = ref(false)
  let noteTimer = null

  const colors = {
    dodgerblue: [30, 144, 255, 200],
    green: [0, 128, 0, 200],
    yellow: [255, 255, 0, 200],
    red: [255, 0, 0, 200],
    orange: [255, 165, 0, 200],
    black: [0, 0, 0, 200],
    gray: [128, 128, 128, 200],
    white: [255, 255, 255, 200],
  }

  function parseMapTypeQueryParam(value, default_value) {
    if (value === undefined || value === null) {
      return default_value
    } else if (value === '0') {
      // map_type backward compatibility: was using numerical values initially
      value = 'mercator'
    } else if (value === '1') {
      value = 'globe'
    }

    if (value === 'mercator' || value === 'globe') {
      return value
    }
    return default_value
  }

  function parseBooleanQueryParam(value, default_value) {
    if (value === undefined || value === null) {
      return default_value
    } else if (value === 'true') {
      return true
    }
    return false
  }

  // Query params
  const start_log = ref(route.query.start_log || route.params.id || null),
    end_log = ref(route.query.end_log || route.params.id || null),
    start_date = ref(route.query.start_date || null),
    end_date = ref(route.query.end_date || null),
    map_type = ref(parseMapTypeQueryParam(route.query.map_type, 'mercator')),
    speed = ref(route.query.speed || 250),
    delay = ref(route.query.delay || 0),
    zoom = ref(route.query.zoom || 13),
    color = ref(colors[route.query.color] || [30, 144, 255, 200]), // Default to dodgerblue
    map_height = ref(route.query.height || `calc(100vh - var(--va-navbar-height, 64px))`),
    moorage_overlay = ref(parseBooleanQueryParam(route.query.moorage_overlay, true)),
    instruments = ref(parseBooleanQueryParam(route.query.instruments, true))

  // Ensure we have end_ parameter if there is a start_ parameter
  if (end_log.value === null && start_log.value != null) {
    end_log.value = start_log.value
  }
  if (end_date.value === null && start_date.value != null) {
    end_date.value = start_date.value
  }

  console.debug(
    'Timelapse3D QS',
    start_log.value,
    end_log.value,
    start_date.value,
    end_date.value,
    map_type.value,
    speed.value,
    delay.value,
    zoom.value,
    color.value,
    map_height.value,
    moorage_overlay.value,
    instruments.value,
  )

  let overlay = null
  let animationTimer = null
  let mediaRecorder = null
  let recordedChunks = []

  // VESSEL TYPE
  const currentVesselType = vesselType || 'Sailing' // Default to 'sailing' if not set
  // filepath, size, orientation per vessel type file
  const vesselsGLB = {
    Sailing: {
      basePitch: 0,
      baseYaw: 0,
      baseRoll: 90,
      path: '/sailboat_1.glb',
      sizeScale: 0.2,
      zOffset: -5, // Lower by 5 meters (adjust as needed)
    },
    Motor: {
      basePitch: 0, // Adjust these if motorboat is tilted wrong
      baseYaw: 180, // Try: 0, 90, 180, -90
      baseRoll: 90, // Try: 0, 90, -90, 180
      path: '/motorboat.glb',
      sizeScale: 60, // Motorboats are often smaller in the model, so scale up
      zOffset: 0, // -15 Lower by 15 meters (motorboat might need more)
    },
    // test 1 origami but with sea water texture, to check if we can do some cool effects with it
    // test2 nice sailboat, 56Mb too big
    // test3 nice sailboat, 21Mb too big
    // test4 old boat
    // test5 simple wood sailboat, 300kb, good for performance testing and mobile
    // test6 simple wood motorboat 5mb
    // test7 good motorboat, 500kb, good for performance testing and mobile
    test: {
      basePitch: 0, // Adjust these if motorboat is tilted wrong
      baseYaw: 0, // Try: 0, 90, 180, -90
      baseRoll: 180, // Try: 0, 90, -90, 180
      path: '/test1.glb',
      sizeScale: 100, // Motorboats are often smaller in the model, so scale up
      zOffset: 0, // -15 Lower by 15 meters (motorboat might need more)
    },
  }
  const vesselConfig = vesselsGLB[currentVesselType] || vesselsGLB.Sailing
  console.debug(`Using model for vessel type: ${currentVesselType} → ${JSON.stringify(vesselsGLB[currentVesselType])}`)

  // Store calculated distances in nautical miles
  const calculatedDistances = ref([])

  // Calculate cumulative distances using MapLibre's built-in method
  function calculateCumulativeDistances(features) {
    const distances = [0] // First point is always 0
    let cumulativeMeters = 0

    for (let i = 1; i < features.length; i++) {
      const from = new maplibregl.LngLat(
        features[i - 1].geometry.coordinates[0],
        features[i - 1].geometry.coordinates[1],
      )
      const to = new maplibregl.LngLat(features[i].geometry.coordinates[0], features[i].geometry.coordinates[1])

      // MapLibre's distanceTo returns meters
      const segmentMeters = from.distanceTo(to)
      cumulativeMeters += segmentMeters

      // Convert meters → km → nautical miles
      const nauticalMiles = (cumulativeMeters / 1000) * 0.539957
      distances.push(nauticalMiles)
    }

    return distances
  }

  // Update computed properties
  const currentDistance = computed(() => {
    if (!calculatedDistances.value?.[currentFrame.value]) return '--'
    const nm = calculatedDistances.value[currentFrame.value]
    return `${nm.toFixed(2)} NM`
  })

  const totalDistance = computed(() => {
    if (!calculatedDistances.value?.length) return '--'
    const nm = calculatedDistances.value[calculatedDistances.value.length - 1]
    return `${nm.toFixed(2)} NM`
  })

  // Computed properties for display
  const totalFrames = computed(() => timelapse.value?.features?.length || 0)

  const currentTimestamp = computed(() => {
    if (!timelapse.value?.features?.[currentFrame.value]) return '--'
    const ts = timelapse.value.features[currentFrame.value].properties.time
    return dateFormatUTC(ts)
  })

  const currentSpeed = computed(() => {
    if (!timelapse.value?.features?.[currentFrame.value]) return '--'
    const spd = timelapse.value.features[currentFrame.value].properties.speedoverground || 0
    return speedFormatKnots(spd)
  })

  const currentWindSpeed = computed(() => {
    if (!timelapse.value?.features?.[currentFrame.value]) return '--'
    const wind = timelapse.value.features[currentFrame.value].properties.windspeedapparent || 0
    return speedFormatKnots(wind)
  })

  const currentAWA = computed(() => {
    if (!timelapse.value?.features?.[currentFrame.value]) return '--'
    const awa = timelapse.value.features[currentFrame.value].properties.anglespeedapparent || 0
    return `${Math.round(awa)}°`
  })

  const tripName = computed(() => {
    if (!timelapse.value?.features?.[0]) return ''
    return timelapse.value.features[0].properties.trip.name || ''
  })

  const currentNote = computed(() => {
    if (!timelapse.value?.features?.[currentFrame.value]) return ''
    return timelapse.value.features[currentFrame.value].properties.notes || ''
  })

  // Watch for notes changes and show overlay temporarily
  watch(currentNote, (newNote) => {
    if (newNote && newNote.trim() !== '') {
      showNoteOverlay.value = true
      // Clear existing timer
      if (noteTimer) clearTimeout(noteTimer)
      // Hide after 5 seconds
      noteTimer = setTimeout(() => {
        showNoteOverlay.value = false
      }, 5000)
    }
  })

  function removeNullValues(obj) {
    for (let key in obj) {
      if (obj[key] === null) {
        delete obj[key]
      }
    }
    return obj
  }

  const instrumentsDisplay = computed(() => {
    return instruments.value ? 'block' : 'none'
  })

  const notesDisplay = computed(() => {
    return moorage_overlay.value ? 'block' : 'none'
  })

  onMounted(async () => {
    // Set sidebar to minimized on map load
    isSidebarMinimized.value = true
    await nextTick() // Wait for DOM to update
    const title = t('timelapse.title') + ': ' + vesselName
    document.title = setAppTitle(title)
    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    const payload = {
      start_log: start_log.value,
      end_log: end_log.value,
      start_date: start_date.value,
      end_date: end_date.value,
    }
    try {
      const qs = new URLSearchParams(removeNullValues(payload))
      const response = await api.timelapse_trips_by_points(qs)
      if (response && response.geojson?.features && response.geojson?.features[0]?.geometry?.coordinates) {
        timelapse.value = response.geojson
        calculatedDistances.value = calculateCumulativeDistances(response.geojson.features)
        //console.debug('Total distance:', totalDistance.value)
        map_setup()
      } else {
        console.warn('error timelapse3d', response)
        if (response.geojson?.features && response.geojson.features[0].geometry.type == null) {
          apiError.value = 'No data available'
          return
        }
      }
    } catch (e) {
      apiError.value = e
    } finally {
      isBusy.value = false
    }
  })

  function map_setup() {
    if (!timelapse.value) return
    const coords = timelapse.value.features.map((f) => f.geometry.coordinates)

    map.value = new maplibregl.Map({
      container: 'mapContainer',
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      //style: 'https://tiles.openfreemap.org/styles/liberty',
      center: coords[0],
      zoom: 13,
      pitch: 55,
      bearing: -15,
      renderWorldCopies: false, // Don't repeat world
    })

    map.value.on('load', () => {
      map.value.setProjection({ type: map_type.value }) // 'mercator' or 'globe'
      overlay = new MapboxOverlay({ interleaved: true })
      map.value.addControl(overlay)
      updateVisualization()
    })
  }

  function updateVisualization() {
    if (!timelapse.value || !overlay) return

    const features = timelapse.value.features
    const currentFeature = features[currentFrame.value]
    const currentIndex = currentFrame.value
    const trail = features.slice(0, currentIndex + 1).map((f) => f.geometry.coordinates)

    // Get current data
    const speed = currentFeature.properties.speedoverground || 0
    const course = currentFeature.properties.courseovergroundtrue || 0

    // FIX: Determine orientation offset based on movement state
    // If at the very first frame OR speed is very low, use 0° offset
    // Otherwise use 180° offset for correct forward movement
    const isStationary = currentIndex === 0 || speed < 0.5
    const courseOffset = isStationary ? 0 : 180

    overlay.setProps({
      layers: [
        new PathLayer({
          id: 'vessel-path',
          data: [{ path: trail }],
          getPath: (d) => d.path,
          //getColor: [220, 38, 38, 200],
          getColor: color.value ? color.value : [220, 38, 38, 200],
          getWidth: 6,
          widthMinPixels: 3,
          widthMaxPixels: 10,
          capRounded: true,
          jointRounded: true,
        }),

        new ScenegraphLayer({
          id: 'vessel-3d',
          data: [currentFeature],
          visible: true,
          pickable: true,

          getPosition: (d) => [
            d.geometry.coordinates[0],
            d.geometry.coordinates[1],
            vesselConfig.zOffset || 0, // Apply vessel-specific Z offset
          ],

          getOrientation: (d) => [
            vesselConfig.basePitch,
            vesselConfig.baseYaw - course + courseOffset,
            vesselConfig.baseRoll,
          ],

          sizeScale: vesselConfig.sizeScale,
          scenegraph: vesselConfig.path,
          _lighting: 'pbr',

          /*
        onHover: ({ object }) => {
          if (object) {
            const props = object.properties || {}
            const info = `
              <strong>${props.trip?.name || 'Trip'}</strong><br/>
              Time: ${dateFormatUTC(props.time)}<br/>
              Speed: ${speedFormatKnots(props.speedoverground || 0)}<br/>
              Wind: ${speedFormatKnots(props.windspeedapparent || 0)} at ${Math.round(props.anglespeedapparent || 0)}°
            `
            initToast({ message: info, color: 'info', timeout: 5000 })
          }
        },
        */
          onClick: ({ object }) => {
            if (object) {
              const props = object.properties || {}
              const info = `
                <strong>${props.trip?.name || 'Trip'}</strong><br/>
                Time: ${dateFormatUTC(props.time)}<br/>
                Speed: ${speedFormatKnots(props.speedoverground || 0)}<br/>
                Wind: ${speedFormatKnots(props.windspeedapparent || 0)} at ${Math.round(props.anglespeedapparent || 0)}°
              `
              initToast({ message: info, color: 'info', timeout: 5000 })
            }
          },
          getTranslation: [0, 0, 0],
          getScale: [1, 1, 1],
          //transitions: {
          //  getPosition: 30000 * 0.9
          //},
          //_animations: {
          //  '*': { speed: 5 }
          //},

          // Error handling
          onError: (error) => {
            console.error('❌ Model load error:', error)
          },
        }),
      ],
    })

    // Smooth camera follow with easing
    if (map.value && currentFeature) {
      map.value.easeTo({
        center: currentFeature.geometry.coordinates,
        duration: 200 / playbackSpeed.value,
        //pitch: 45,           // Always top-down
        //bearing: -course,   // Rotate map so boat always points up
        easing: (t) => t * (2 - t),
      })
    }
  }

  function animate() {
    if (!isPlaying.value || currentFrame.value >= totalFrames.value - 1) {
      isPlaying.value = false
      return
    }

    currentFrame.value++
    updateVisualization()

    const baseDelay = speed.value
    const adjustedDelay = baseDelay / playbackSpeed.value
    animationTimer = setTimeout(animate, adjustedDelay)
  }

  function togglePlayPause() {
    if (isPlaying.value) {
      isPlaying.value = false
      if (animationTimer) clearTimeout(animationTimer)
    } else {
      if (currentFrame.value >= totalFrames.value - 1) {
        currentFrame.value = 0
      }
      isPlaying.value = true
      animate()
    }
  }

  async function startRecording() {
    if (!map.value || isRecording.value) return

    try {
      const constraints = { audio: false, video: true }
      const canvas = map.value.getCanvas()
      const stream = canvas.captureStream(30)

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
        videoBitsPerSecond: 5000000,
      })

      recordedChunks = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `timelapse-${vesselName}-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
        isRecording.value = false
        initToast({ message: 'Recording saved!', color: 'success' })
      }

      mediaRecorder.start()
      isRecording.value = true

      // Auto-play and stop at end
      currentFrame.value = 0
      isPlaying.value = true
      animate()

      // Stop recording when animation ends
      const checkEnd = setInterval(() => {
        if (currentFrame.value >= totalFrames.value - 1 && isRecording.value) {
          mediaRecorder.stop()
          clearInterval(checkEnd)
        }
      }, 100)
    } catch (error) {
      console.error('Recording error:', error)
      initToast({ message: 'Recording failed: ' + error.message, color: 'danger' })
    }
  }

  function toggleFullscreen() {
    const elem = mapContainer.value
    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => {
        isFullscreen.value = true
      })
    } else {
      document.exitFullscreen().then(() => {
        isFullscreen.value = false
      })
    }
  }

  onBeforeUnmount(() => {
    isPlaying.value = false
    if (animationTimer) clearTimeout(animationTimer)
    if (noteTimer) clearTimeout(noteTimer)
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    if (map.value) map.value.remove()
  })

  // Watch for sidebar changes and adjust map
  watch(isSidebarMinimized, () => {
    if (map.value) {
      // Give map time to adjust, then resize
      setTimeout(() => {
        map.value.resize()
      }, 300)
    }
  })
</script>

<style>
  /* Unscoped to affect parent */
  .app-layout__page:has(.leaflet-map) {
    overflow-y: hidden !important;
    padding: 0 !important;
  }
</style>

<style scoped>
  .loading-wrapper {
    width: 100%;
    height: 100%;
  }

  #mapContainer {
    width: 100%;
    height: 100%;
  }

  /* Map Control Base Positioning */
  .map-control {
    position: absolute;
    z-index: 1000;
    pointer-events: none;
  }

  .map-control > * {
    pointer-events: auto;
  }

  /* Position Classes */
  .bottom-center {
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
  }

  .top-center {
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 90%;
    /* Prevent overflow */
  }

  .top-right {
    top: 20px;
    right: 20px;
  }

  .bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .bottom-left {
    bottom: 20px;
    left: 20px;
  }

  /* Legend Widget (Bottom Center) */
  .legend {
    background: rgba(255, 255, 255, 0.75);
    opacity: 0.8;
    /* Reduced from 0.95 */
    backdrop-filter: blur(8px);
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    padding: 12px 20px;
    min-width: 350px;
  }

  .legend .top-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin-bottom: 8px;
  }

  .legend .distance {
    font-size: 18px;
    font-weight: 600;
    color: #2c3e50;
  }

  .legend .player,
  .legend .recorder {
    cursor: pointer;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(25, 118, 210, 0.85);
    /* More transparent */
    color: white;
    transition: all 0.2s ease;
  }

  .legend .player:hover,
  .legend .recorder:hover {
    background: rgba(21, 101, 192, 0.95);
    transform: scale(1.05);
  }

  .legend .recorder {
    background: rgba(244, 67, 54, 0.85);
    /* More transparent */
  }

  .legend .recorder.recording {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.6;
    }
  }

  .legend .recorder:hover {
    background: rgba(211, 47, 47, 0.95);
  }

  .legend .bottom-row {
    text-align: center;
  }

  .legend .datetime {
    font-size: 14px;
    color: #546e7a;
  }

  /* Overlay Widget (Top Center) */
  .overlay {
    background: rgba(255, 255, 255, 0.75);
    opacity: 0.8;
    /* Reduced from 0.95 */
    backdrop-filter: blur(8px);
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    padding: 16px 24px;
    min-width: 300px;
    max-width: 600px;
    animation: fadeIn 0.3s ease;
    text-align: center;
    /* Center all content */
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .overlay .top-row {
    margin-bottom: 10px;
  }

  .overlay .trip {
    font-size: 18px;
    font-weight: 600;
    color: #1976d2;
    display: block;
    text-align: center;
  }

  .overlay .bottom-row {
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    padding-top: 10px;
    display: flex;
    justify-content: center;
    /* Center the note */
    align-items: center;
  }

  .overlay .note {
    font-size: 15px;
    color: #37474f;
    display: block;
    font-style: italic;
    text-align: center;
    line-height: 1.5;
    max-width: 100%;
    word-wrap: break-word;
  }

  /* Instruments Panel (Top Right) */
  .instruments {
    background: rgba(255, 255, 255, 0.75);
    opacity: 0.8;
    /* Reduced from 0.95 */
    backdrop-filter: blur(8px);
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    padding: 16px;
    min-width: 150px;
  }

  .instruments > div {
    margin-bottom: 12px;
  }

  .instruments > div:last-child {
    margin-bottom: 0;
  }

  .instruments .label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #78909c;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }

  .instruments .value {
    display: block;
    font-size: 20px;
    font-weight: 700;
    color: #1976d2;
  }

  /* Fullscreen Button */
  .fullscreen-btn {
    background: rgba(255, 255, 255, 0.75);
    /* Reduced from 0.95 */
    backdrop-filter: blur(8px);
    border: none;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fullscreen-btn:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: scale(1.05);
  }

  .fullscreen-btn i {
    font-size: 24px;
    color: #1976d2;
  }

  /* Speed Control */
  .speed-control {
    background: rgba(255, 255, 255, 0.75);
    /* Reduced from 0.95 */
    backdrop-filter: blur(8px);
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    padding: 8px;
  }

  .speed-select {
    background: transparent;
    border: none;
    font-size: 14px;
    font-weight: 600;
    color: #1976d2;
    cursor: pointer;
    outline: none;
    padding: 4px 8px;
  }

  .speed-select:hover {
    background: rgba(25, 118, 210, 0.08);
    border-radius: 4px;
  }

  .leaflet-map {
    width: 100vw;
    height: calc(100vh - var(--va-navbar-height, 64px));
    position: relative;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }
</style>
