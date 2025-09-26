<template>
  <va-alert color="info" outline class="mb-4">Work in progress! We’d love to hear your feedback!</va-alert>
  <template v-if="apiError">
    <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ apiError }}</va-alert>
  </template>
  <va-inner-loading :loading="isBusy">
    <div id="mapContainer" ref="mapContainer" class="w-full h-screen"></div>
  </va-inner-loading>
</template>

<script setup>
  import { onMounted, ref, onBeforeUnmount } from 'vue'
  import maplibregl from 'maplibre-gl'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import { MapboxOverlay } from '@deck.gl/mapbox'
  import { PathLayer, IconLayer } from '@deck.gl/layers'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { setAppTitle } from '../../utils/app.js'
  import PostgSail from '../../services/api-client'
  import { distanceFormat } from '../../utils/distanceFormatter.js'
  import { dateFormatUTC } from '../../utils/dateFormatter.js'
  import { angleFormat, awaFormat } from '../../utils/angleFormatter.js'
  import { speedFormatKnots } from '../../utils/speedFormatter.js'
  import { useToast, useModal } from 'vuestic-ui'
  const { init: initToast } = useToast()
  const { confirm } = useModal()
  import { useVesselStore } from '../../stores/vessel-store'
  import { useGlobalStore } from '../../stores/global-store'

  const { isLoggedIn, publicVessel, publicTimelapse } = useGlobalStore()
  const { vesselName, vesselType } = useVesselStore()
  const { t } = useI18n()

  const route = useRoute(),
    //{ t } = useI18n(),
    //GlobalStore = useGlobalStore(),
    isBusy = ref(false),
    apiError = ref(null),
    mapContainer = ref(),
    map = ref(),
    polyLine = ref(),
    dotMarker = ref(null),
    boatMarker = ref(null),
    timelapse = ref(),
    stopped = ref(false),
    play_pause = ref(true)

  const ICON_URL = '/sailboaticon.png'

  const start_log = ref(route.query.start_log || route.params.id || null),
    end_log = ref(route.query.end_log || route.params.id || null),
    start_date = ref(route.query.start_date || null),
    end_date = ref(route.query.end_date || null),
    //map_type = ref(parseMapTypeQueryParam(route.query.map_type, 'Satellite')),
    //boat_type = ref(parseBoatTypeQueryParam(route.query.boat_type, fallbackBoatType)),
    speed = ref(route.query.speed || 250),
    delay = ref(route.query.delay || 0),
    zoom = ref(route.query.zoom || 13),
    color = ref(route.query.color || 'dodgerblue'),
    map_height = ref(route.query.height || 'calc(100vh - 4.5rem)')
  //moorage_overlay = ref(parseBooleanQueryParam(route.query.moorage_overlay, true)),
  //instruments = ref(parseBooleanQueryParam(route.query.instruments, true))

  let overlay = null
  let i = 0
  let trail = []
  let animationTimer = null
  let stopAnimation = false

  function removeNullValues(obj) {
    // Iterate through the object keys
    for (let key in obj) {
      // Check if the value is null
      if (obj[key] === null) {
        delete obj[key] // Remove the key from the object
      }
    }
    return obj
  }

  onMounted(async () => {
    const title = t('timelapse.title') + ': ' + vesselName
    document.title = setAppTitle(title)
    isBusy.value = true
    apiError.value = null
    const api = new PostgSail(),
      payload = {
        start_log: start_log.value,
        end_log: end_log.value,
        start_date: start_date.value,
        end_date: end_date.value,
      }
    try {
      //const response = await api.timelapse_by_points(payload) // POST
      const qs = new URLSearchParams(removeNullValues(payload)) // GET Read-only
      console.debug(qs.toString())
      const response = await api.timelapse_trips_by_points(qs)
      if (response && response.geojson?.features && response.geojson?.features[0]?.geometry?.coordinates) {
        timelapse.value = response.geojson
        map_setup()
      } else {
        console.warn('error timelapse3d', response)
        // If empty data, display a world map.
        if (response.geojson?.features && response.geojson.features[0].geometry.type == null) {
          console.warn('no data')
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

    // Init map with 3D tilt
    map.value = new maplibregl.Map({
      container: 'mapContainer',
      //style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: coords[0],
      zoom: 14,
      pitch: 60,
      bearing: -20,
    })

    overlay = new MapboxOverlay({ interleaved: true })
    map.value.addControl(overlay)

    animate()
  }

  function animate() {
    if (stopAnimation) return
    if (!timelapse.value) return

    const features = timelapse.value.features
    if (i >= features.length) return

    // current feature
    const f = features[i]
    trail.push(f.geometry.coordinates)

    overlay.setProps({
      layers: [
        // Growing red path
        new PathLayer({
          id: 'vessel-path',
          data: [{ path: trail }],
          getPath: (d) => d.path,
          getColor: [200, 0, 0],
          getWidth: 25,
        }),
        // Moving vessel icon (rotated by heading)
        new IconLayer({
          id: 'vessel',
          data: [f],
          getPosition: (d) => d.geometry.coordinates,
          getIcon: () => ({
            url: ICON_URL,
            width: 32,
            height: 32,
            anchorY: 32,
          }),
          sizeScale: 4,
          getAngle: (d) => d.properties.courseovergroundtrue || 0,
        }),
      ],
    })

    // Pan camera to vessel
    map.value.easeTo({
      center: f.geometry.coordinates,
      duration: 100,
      pitch: 60,
      bearing: map.value.getBearing(),
      zoom: map.value.getZoom(),
    })

    i++
    animationTimer = setTimeout(animate, 150)
  }

  onBeforeUnmount(() => {
    stopAnimation = true
    if (animationTimer) clearTimeout(animationTimer)
    if (map.value) map.value.remove()
  })
</script>
