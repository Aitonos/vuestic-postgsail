<script setup>
  /* eslint-disable */
  import { onMounted, ref, computed, watch, reactive, onBeforeUnmount, nextTick } from 'vue'
  import 'leaflet/dist/leaflet.css'
  import 'leaflet.sidepanel/dist/leaflet.sidepanel.css'
  import L from 'leaflet'
  import 'leaflet.sidepanel'
  import 'leaflet-rotatedmarker'
  import SmoothMarkerBouncing from 'leaflet.smooth_marker_bouncing'
  import 'leaflet.fullscreen'

  import PostgSail from '../../services/api-client'
  import {
    dateFormatUTC,
    durationFormatHours,
    durationHours,
    fromNow,
    durationFromNow,
  } from '../../utils/dateFormatter.js'
  import { distanceFormatMiles, distanceFormat, depthFormatI18n } from '../../utils/distanceFormatter.js'
  import { awaFormat, angleFormat } from '../../utils/angleFormatter.js'
  import { speedFormatKnots } from '../../utils/speedFormatter.js'
  import { stayed_at_options } from '../../utils/PostgSail.ts'
  import { kelvinToHuman } from '../../utils/temperatureFormatter.js'
  import { pascalToHectoPascal } from '../../utils/presureFormatter.js'
  import { floatToPercentage } from '../../utils/percentageFormatter.js'
  import { default as utils } from '../../utils/utils.js'
  import { decimalToDMS } from '../../utils/dms'
  import { baseMaps, overlayMaps, boatMarkerTypes } from './leafletHelpers.js'

  import echartsProgress from '../../components/echarts/progress.vue'
  import echartsGauge from '../../components/echarts/gauge.vue'
  //import echartsPressure from '../../components/echarts/gaugePressure.vue'
  import echartsPressure from '../../components/echarts/timeseries.vue'

  import { storeToRefs } from 'pinia'
  import { useGlobalStore } from '../../stores/global-store'
  import { useCacheStore } from '../../stores/cache-store'
  import { useVesselStore } from '../../stores/vessel-store'

  const GlobalStore = useGlobalStore()
  const CacheStore = useCacheStore()
  const { isSidebarMinimized, currentTheme } = storeToRefs(GlobalStore)
  const { vesselName, vesselType, vesselModel, vesselImage } = useVesselStore()

  import { useI18n } from 'vue-i18n'
  const { t } = useI18n()

  // Adds bouncing plugin code to the global L variable
  SmoothMarkerBouncing(L)
  // Sets options of bouncing of all markers
  L.Marker.setBouncingOptions({
    bounceHeight: 60, // height of the bouncing
    bounceSpeed: 54, // bouncing speed coefficient
    exclusive: true, // if this marker is bouncing all others must stop
  })

  const isBusy = ref(false)
  const apiError = ref(null)
  const api_geojson = ref({})
  const map = ref(null)
  const currentZoom = ref(7)
  const mooragesLayers = ref([])
  const mooragesMakers = ref([])
  const logsLayers = ref([])
  const mooragesList = ref([])
  const logsList = ref([])
  const mapBounds = ref(null)
  const api_monitoring = ref({})
  const filter = reactive({
    dateRange: [0, 10],
    tags: [],
  })
  const stats = reactive({
    logs: {
      count: 0,
      distance: 0,
      duration: 0,
    },
    moorages: {
      count: 0,
      duration: 0,
    },
  })

  onMounted(async () => {
    isBusy.value = true
    apiError.value = null
    try {
      const api = new PostgSail()
      const response = await api.logs_mapgl()
      if (response.geojson) {
        api_geojson.value = response.geojson
        console.debug('Explore map geojson', api_geojson.value)
      } else {
        throw { response }
      }
    } catch (e) {
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', e)
        api_geojson.value = {}
        apiError.value = 'Error'
        isBusy.value = false
        return
      }
    } finally {
      isBusy.value = false
    }

    // Extract the first coordinates as a center
    const coords = api_geojson.value.features[0].geometry.coordinates[0]
    map.value = L.map(document.getElementById('explore-map'), {
      //center: [coords[1], coords[0]],
      zoom: currentZoom.value,
      zoomControl: false,
      easeLinearity: 0.35, // Lower = smoother panning
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      zoomAnimation: true,
      markerZoomAnimation: true,
    })
    // Track zoom level and hide/show labels based on zoom
    map.value.on('zoomend', () => {
      currentZoom.value = map.value.getZoom()
    })
    const bMaps = baseMaps()
    const oMaps = overlayMaps()
    bMaps['OpenStreetMap'].addTo(map.value)
    L.control.layers(bMaps, oMaps).addTo(map.value)
    // Zoom to bottomright
    L.control.zoom({ position: 'bottomright' }).addTo(map.value)
    // create a fullscreen button and add it to the map
    L.control
      .fullscreen({
        position: 'bottomright', // change the position of the button can be topleft, topright, bottomright or bottomleft, default topleft
        content: '<i class="va-icon material-icons">fullscreen</i>', // change the content of the button, can be HTML, default null
      })
      .addTo(map.value)

    // Backup full list of moorages and logs
    mooragesList.value = mooragesListFull.value
    logsList.value = logsListFull.value

    // Add moorage layers (each Point as a separate layer)
    mooragesLayers.value = mooragesList.value.map((feature) => {
      //console.debug(feature)
      return L.geoJSON(feature, {
        pointToLayer: markerIcon,
        onEachFeature: onEachMoorageFeaturePopup,
      })
    })

    // Add log layers (each LineString as a separate layer)
    logsLayers.value = logsList.value.map((feature) => {
      //console.debug(feature)
      return L.geoJSON(feature, {
        style: function (feature) {
          return { color: random_rgb_dark(), weight: 3 } // Apply random color to each LineString
        },
        onEachFeature: onEachLogFeaturePopup,
      })
    })

    L.control
      .sidepanel('sidepanel', {
        panelPosition: 'left',
        hasTabs: true,
        tabsPosition: 'top',
        pushControls: true,
        darkMode: currentTheme.value === 'dark',
        startTab: 'tab-1',
      })
      .addTo(map.value)

    map.value.whenReady(function () {
      addResetViewControl()
      addResetFilterControl()
      const sidepanel = document.getElementById('sidepanel')

      // Watch class changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            if (sidepanel.classList.contains('opened')) {
              sidepanel.setAttribute('aria-hidden', 'false')
              // Sidebar has been opened
              console.debug('Sidebar opened — updating map')
              updateMap()
            } else {
              sidepanel.setAttribute('aria-hidden', 'true')
            }
          }
        })
      })

      observer.observe(sidepanel, { attributes: true })

      // Open sidepanel initially
      const toggleButton = document.querySelector('.sidepanel-toggle-button')
      if (toggleButton) toggleButton.click()
      // trigger map resize
      map.value.invalidateSize()
    })

    observer.observe(document.getElementById('explore-map'))

    // Add initial logs and moorages layer
    updateMap()

    // Minimize sidebar
    isSidebarMinimized.value = true
  }) // end onMounted

  const observer = new ResizeObserver(() => {
    if (map.value) {
      nextTick(() => {
        map.value.invalidateSize()
      })
    }
  })

  // Extract all geometry Point from geojson to get a list of moorage geojson feature for map
  const mooragesListFull = computed(() => {
    if (!api_geojson.value?.features) return []
    return api_geojson.value.features
      .filter((feature) => feature.geometry.type === 'Point')
      .sort((a, b) => b.geometry.coordinates[1] - a.geometry.coordinates[1]) // north to south
      .map((feature, index) => {
        feature.properties['moorageIndex'] = index // keep original index
        if (feature.properties.default_stay_id == 3) {
          feature.properties['iconUrl'] = '/mooring_icon.png'
        } else if (feature.properties.default_stay_id == 4) {
          feature.properties['iconUrl'] = '/dock_icon.png'
        } else {
          feature.properties['iconUrl'] = '/anchoricon.png'
        }
        return feature
      })
  })

  // Extract all geometry LineString from geojson to get a list of log geojson feature for map
  const logsListFull = computed(() => {
    if (!api_geojson.value?.features) return []
    return api_geojson.value.features
      .filter((feature) => feature.geometry.type === 'LineString')
      .map((feature, index) => {
        feature.properties['logIndex'] = index // keep original index
        const midPoint = Math.round(feature.geometry.coordinates.length / 2)
        const centerLat = parseFloat(feature.geometry.coordinates[midPoint][1])
        const centerLng = parseFloat(feature.geometry.coordinates[midPoint][0])
        feature['properties']['centercoords'] = [centerLat, centerLng]
        return feature
      })
  })

  // Extract all geometry LineString from geojson to get a list of log date for slider
  const logsSlider = computed(() => {
    if (!api_geojson.value?.features) return []
    return api_geojson.value.features
      .filter((feature) => feature.geometry.type === 'LineString')
      .map((feature) => feature.properties.starttimestamp)
  })

  // Extract all geometry LineString from geojson to get a list of tags for filter
  const logsTags = computed(() => {
    if (!api_geojson.value?.features) return []
    const tagSet = new Set()
    api_geojson.value.features
      .filter((feature) => feature.geometry?.type === 'LineString')
      .forEach((feature) => {
        const tags = feature?.properties?.extra?.tags
        if (Array.isArray(tags)) {
          tags.forEach((tag) => tagSet.add(tag))
        }
      })
    return Array.from(tagSet).sort()
  })

  // Update map layers (Logs and moorages) and set bounds
  const updateMap = () => {
    if (!map.value) return

    // Remove all existing layers from map
    logsLayers.value.forEach((layer) => map.value.removeLayer(layer))
    mooragesLayers.value.forEach((layer) => map.value.removeLayer(layer))

    // Reset visible lists
    logsList.value = []
    mooragesList.value = []
    // Reset Stats
    stats.logs.count = 0
    stats.logs.duration = 0
    stats.logs.distance = 0
    stats.moorages.count = 0

    // Get selected date range
    const [startIdx, endIdx] = filter.dateRange
    const logStart = new Date(logsListFull.value[startIdx].properties.starttimestamp)
    const logEnd = new Date(logsListFull.value[endIdx].properties.endtimestamp)
    // Track moorage IDs referenced by logs
    const referencedMoorageIds = new Set()

    console.debug('filter.tags, filter.dateRange', filter.tags, filter.dateRange)
    //console.debug('logsListFull', logsListFull.value)

    // Add logs in range and tags
    for (let i = startIdx; i <= endIdx; i++) {
      const logFeature = logsListFull.value[i]
      // Extract tags from the feature
      const featureTags = logFeature.properties?.extra?.tags ?? []
      // If tag filter is active, check if any tag matches
      const matchesTags = filter.tags.length === 0 || featureTags.some((tag) => filter.tags.includes(tag))
      if (matchesTags && logsLayers.value[i]) {
        map.value.addLayer(logsLayers.value[i])
        logsList.value.push(logFeature)
        // Track referenced moorage IDs
        const fromId = logFeature.properties?._from_moorage_id
        const toId = logFeature.properties?._to_moorage_id
        if (fromId) referencedMoorageIds.add(fromId)
        if (toId) referencedMoorageIds.add(toId)
        stats.logs.count++
        stats.logs.duration += durationHours(logFeature.properties?.duration) || 0
        stats.logs.distance += logFeature.properties?.distance || 0
      }
    }
    //console.debug('logsList', logsList.value.length)
    if (logsList.value.length === 0) {
      // If no logs are found, show a message or handle it accordingly
      console.warn('No logs found for the selected date range and tags. resetting...')
      filter.tags = [] // Reset tags
      filter.dateRange = [0, logsListFull.value.length - 1] // Reset range to the new limits
    }

    // Add moorages in range
    mooragesListFull.value.forEach((moorageFeature, i) => {
      const moorageId = moorageFeature.properties.id
      const moorageStart = new Date(moorageFeature.properties.stay_first_seen)
      const moorageEnd = new Date(moorageFeature.properties.stay_last_seen)

      if (moorageStart <= logEnd && moorageEnd >= logStart && referencedMoorageIds.has(moorageId)) {
        mooragesList.value.push(moorageFeature)
        if (mooragesLayers.value[i]) {
          map.value.addLayer(mooragesLayers.value[i])
          stats.moorages.count++
          stats.moorages.duration += moorageFeature.properties?.stays_sum_duration || 0
        }
      }
    })
    // Stats summary
    stats.logs.duration = parseFloat(stats.logs.duration).toFixed(1) + ' h'
    stats.logs.distance = distanceFormatMiles(stats.logs.distance)
    //console.debug('Stats', stats)

    // Logs bounds
    const updatedBounds = L.latLngBounds([])

    // Loop through each layer and extend the bounds with its coordinates
    mooragesLayers.value.forEach((layer) => {
      if (map.value.hasLayer(layer)) {
        layer.eachLayer((featureLayer) => {
          if (featureLayer.getLatLng) {
            updatedBounds.extend(featureLayer.getLatLng())
          }
        })
      }
    })

    // Fit the map to the calculated bounds
    if (updatedBounds.isValid() && map.value) {
      map.value.fitBounds(updatedBounds)
      // Save the bounds to the mapBounds ref
      mapBounds.value = updatedBounds
    }
  } // End updateMap

  const addResetViewControl = () => {
    if (!map.value) return

    const resetControl = L.control({ position: 'topright' })

    resetControl.onAdd = function (mapInstance) {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
      const link = L.DomUtil.create('a', '', div)
      link.innerHTML = '<i class="va-icon material-icons">refresh</i>'
      link.href = '#'
      div.title = 'Reset View'

      L.DomEvent.on(div, 'click', function (e) {
        L.DomEvent.stopPropagation(e)
        L.DomEvent.preventDefault(e)
        updateMap()
      })

      return div
    }

    resetControl.addTo(map.value)
  }

  const addResetFilterControl = () => {
    if (!map.value) return

    const resetFilter = L.control({ position: 'topright' })
    resetFilter.onAdd = function (mapInstance) {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
      const link = L.DomUtil.create('a', '', div)
      link.innerHTML = '<i class="va-icon material-icons">filter_alt_off</i>'
      link.href = '#'
      div.title = 'Reset Filter'

      L.DomEvent.on(div, 'click', function (e) {
        L.DomEvent.stopPropagation(e)
        L.DomEvent.preventDefault(e)
        filter.tags = [] // Reset tags
        filter.dateRange = [0, logsListFull.value.length - 1] // Reset range to the new limits
      })

      return div
    }

    resetFilter.addTo(map.value)
  }

  const onEachLogFeaturePopup = (feature, layer) => {
    //console.debug(feature)
    // is logbook
    let starttime = dateFormatUTC(feature.properties.starttimestamp)
    let endtime = dateFormatUTC(feature.properties.endtimestamp)
    let duration = durationFormatHours(feature.properties.duration)
    let distance = distanceFormatMiles(feature.properties.distance)
    let avg_speed = speedFormatKnots(feature.properties.avg_sog)
    let max_speed = speedFormatKnots(feature.properties.max_sog)
    let avg_depth = depthFormatI18n(feature.properties.avg_depth)
    let max_depth = depthFormatI18n(feature.properties.max_depth)
    let avg_tws = speedFormatKnots(feature.properties.avg_tws)
    let max_tws = speedFormatKnots(feature.properties.max_tws)
    let notes = feature.properties?.notes || ''
    let text = `<div class='mpopup'>
                          <h4><a href="/log/${feature.properties.id}">${feature.properties.name}</a></h4><br/>
                          <table class='data'><tbody>
                          <tr><th>Start Time</th><td>${starttime}</td></tr>
                          <tr><th>End Time</th><td>${endtime}</td></tr>
                          <tr><th>Distance</th><td>${distance}</td></tr>
                          <tr><th>Duration</th><td>${duration} hours</td></tr>
                          <tr><th>Speed</th><td>avg ${avg_speed} / max ${max_speed}</td></tr>
                          <tr><th>Wind</th><td>avg ${avg_tws} / max ${max_tws}</td></tr>
                          <tr><th>Depth</th><td>avg ${avg_depth} / max ${max_depth}</td></tr>
                          <tr><th>Notes</th><td>${notes}</td></tr>
                          </tbody></table></br>
                          <a href="/timelapse/${feature.properties.id}">Replay</a>
                        </div>`
    //layer.bindPopup(text)
    layer.bindPopup(text, {
      autoPan: true,
      autoPanPadding: L.point(30, 30),
    })
    layer.bindTooltip(text)
  }

  const onEachMoorageFeaturePopup = function (feature, layer) {
    //console.debug(feature)
    var popupContent = '<p>I started out as a GeoJSON ' + feature.geometry.type + ", but now I'm a Leaflet vector!</p>"
    if (feature.properties && feature.properties.id) {
      let duration = durationFormatHours(feature.properties.stays_sum_duration)
      let popup = `<div class='mpopup'><center><h4><a href="/moorage/${feature.properties.id}">${feature.properties.name}</a></h4></center>`
      popup += '<table class="data">'
      popup += '</a></td></tr>'
      popup += '<tr><th>Visits</th><td><a href="/moorage/arrivals-departures/' + feature.properties.id + '">'
      popup += `${feature?.properties?.stays_count}`
      popup += '</a></td></tr>'
      popup += '<tr><th>Duration</th><td>'
      popup += '<a href="/stays/moorage/' + feature.properties.id + '">' + (duration || 0) + ' hour'
      if ((duration || 0) > 1) popup = popup + 's'
      popup = popup + '</a></td></tr>'
      popup +=
        '<tr><th>Preference</th><td>' + stayed_at_options[feature.properties.default_stay_id - 1].text + '</td></tr>'
      if (feature?.properties?.notes) {
        popup += '<tr><th>Notes</th><td>' + feature?.properties?.notes + '</td></tr>'
      }
      popup += '</table></div>'
      popupContent = popup
    }
    layer.bindPopup(popupContent, {
      autoPan: true,
      autoPanPadding: L.point(30, 30),
    })
    //layer.bindTooltip(popupContent)
    /*
    layer.on('mouseover', function () {
      layer.bounce({ duration: 500, height: 80 })
      layer.openPopup()
    })
    layer.on('mouseout', function () {
      layer.stopBouncing()
      layer.closePopup()
    })
    */
  }

  const markerIcon = function (feature, latlng) {
    let multiplier = Math.max(map.value.getZoom(), 1)
    multiplier = Math.min(map.value.getZoom(), 9)
    //console.debug('multiplier', multiplier)
    let myMarker = null
    if (feature.properties.default_stay_id == 3) {
      myMarker = L.marker(latlng, {
        icon: new L.Icon({
          iconSize: [multiplier * 4, multiplier * 4],
          iconAnchor: [multiplier * 2, multiplier * 2],
          iconUrl: '/mooring_icon.png',
          popupAnchor: [0, 0],
        }),
      })
    }
    if (feature.properties.default_stay_id == 4) {
      myMarker = L.marker(latlng, {
        icon: new L.Icon({
          iconSize: [multiplier * 4, multiplier * 4],
          iconAnchor: [multiplier * 2, multiplier * 2],
          iconUrl: '/dock_icon.png',
          popupAnchor: [0, 0],
        }),
      })
    } else {
      myMarker = L.marker(latlng, {
        icon: new L.Icon({
          iconSize: [multiplier * 4, multiplier * 4],
          iconAnchor: [multiplier * 2, multiplier * 2],
          iconUrl: '/anchoricon.png',
          popupAnchor: [0, 0],
        }),
      })
    }
    //console.debug(myMarker)
    mooragesMakers.value.push(myMarker)
    return myMarker
  }

  function random_rgb_dark() {
    var o = Math.floor,
      r = Math.random,
      s = 256
    return 'rgb(' + o(r() * s) + ',' + o(r() * s) + ',' + o(r() * s) + ')'
  }

  // Watch for changes in dateArray and update selectedRange accordingly
  watch(logsSlider, (newValue) => {
    filter.dateRange = [0, newValue.length - 1] // Reset range to the new limits
  })

  // Compute the formatted date range to display the selected dates
  const formattedDateRange = computed(() => {
    const startDate = logsSlider.value[filter.dateRange[0]] // Get start date
    const endDate = logsSlider.value[filter.dateRange[1]] // Get end date
    return `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`
  })

  // Function to format a date for display in a user-friendly format
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Function to format the label shown on the slider for each marker
  const formatDateLabel = (index) => {
    const date = new Date(logsSlider.value[index])
    return formatDate(date)
  }
  // Function to display tooltip text with the selected date range
  const tooltipLabel = computed(() => {
    const startDate = logsSlider.value[filter.dateRange[0]]
    const endDate = logsSlider.value[filter.dateRange[1]]
    return `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`
  })

  const onLogClickNavigate = (coordinates, index) => {
    if (isNaN(index)) return
    //console.debug('onLogClickNavigate', index)
    logsLayers.value.forEach((geoJSONLayer, i) => {
      //console.debug(geoJSONLayer, i, index)
      if (i === index) {
        map.value.addLayer(geoJSONLayer)
        //map.value.flyTo(coordinates)
        setTimeout(() => {
          map.value.fitBounds(geoJSONLayer.getBounds(), { animate: true, duration: 0.5 })
          geoJSONLayer.eachLayer(function (featureLayer) {
            if (featureLayer.openPopup) {
              // Open the popup
              featureLayer.openPopup()
              // Close the side panel
              sidepanelToggleButton()
            }
          })
        }, 600)
      } else {
        map.value.removeLayer(geoJSONLayer)
      }
    })
  }
  const onMoorageClickNavigate = (coordinates, index) => {
    if (isNaN(index)) return
    //console.debug('onMoorageClickNavigate', coordinates, index)
    const latlng = L.latLng(coordinates[1], coordinates[0])
    //map.value.flyTo(latlng)
    // Find and open popup on the matching layer
    const layer = mooragesLayers.value[index]
    if (layer && layer.getLayers) {
      const markerLayer = layer.getLayers()[0] // assuming one marker per feature
      if (markerLayer && markerLayer.openPopup) {
        setTimeout(() => {
          // Fit map on all moorages layer
          map.value.fitBounds(mapBounds.value, { animate: true, duration: 0.5 })
          // Open the popup
          markerLayer.openPopup()
          // Close the side panel
          sidepanelToggleButton()
        }, 600) // wait until flyTo animation completes
      }
    }
  }

  const onMoorageMouseEnter = (id) => {
    if (isNaN(id)) return
    const marker = mooragesMakers.value[id]
    if (marker && marker?._icon && !marker._icon.classList.contains('bouncing')) {
      marker._icon.classList.add('bouncing')
      marker._bouncingMotion.isBouncing = true

      // Gently pan to marker instead of fitting bounds
      map.value.panTo(marker.getLatLng(), { animate: true, duration: 0.5 })
    }
  }
  const stopBouncingMarker = (id) => {
    if (isNaN(id)) return
    const marker = mooragesMakers.value[id]
    //console.debug('stopBouncingMarker', marker)
    if (marker && marker?._icon && marker._icon.classList.contains('bouncing')) {
      marker._icon.classList.remove('bouncing')
    }
  }
  const onLogMouseEnter = (index) => {
    if (isNaN(index)) return
    logsLayers.value.forEach((layer, i) => {
      if (i === index) {
        map.value.addLayer(layer)

        const center = layer.getBounds().getCenter()

        // Instead of fitting the full bounds (jumps the zoom), just softly pan
        map.value.panTo(center, { animate: true, duration: 0.5 })

        // Optionally: If center is outside view, you can use panInsideBounds
        const bounds = layer.getBounds()
        map.value.panInsideBounds(bounds, { animate: true, duration: 0.5, padding: [50, 50] })

        // (Optional) Open the tooltip instead of popup to stay lightweight
        layer.openTooltip()
      } else {
        map.value.removeLayer(layer)
      }
    })
  }
  const onMouseLeaveLog = (index) => {
    // Remove all log layers
    logsLayers.value.forEach((layer) => map.value.removeLayer(layer))

    // Add back only selected ones
    const [startIdx, endIdx] = filter.dateRange
    for (let i = startIdx; i <= endIdx; i++) {
      if (logsLayers.value[i]) {
        map.value.addLayer(logsLayers.value[i])
      }
    }
  }

  const sidepanelToggleButton = () => {
    const toggleButton = document.querySelector('.sidepanel-toggle-button')
    //console.debug('sidepanelToggleButton', toggleButton)
    if (toggleButton) {
      toggleButton.click()
    }
  }
  const onLogsResetClick = (event) => {
    event.preventDefault() // if you're preventing default anchor behavior
    console.debug('Logs tab clicked')
    // Show all logs
    filter.dateRange = [0, logsListFull.value.length - 1]
  }
  const onLogsTabClick = (event) => {
    event.preventDefault() // if you're preventing default anchor behavior
    console.debug('Logs tab clicked')
    // Show all logs
    //filter.dateRange = [0, logsListFull.value.length - 1]
  }
  const onMooragesTabClick = (event) => {
    event.preventDefault() // if you're preventing default anchor behavior
    console.debug('Moorages tab clicked')
    // Show all Moorages
    //filter.dateRange = [0, logsListFull.value.length - 1]
  }
  const onMonitoringTabClick = async (event) => {
    event.preventDefault() // if you're preventing default anchor behavior
    console.debug('Monitoring tab clicked')
    await fetchMonitoring()
  }
  const fetchMonitoring = async () => {
    // fetch the monitoring tab content
    console.debug('Monitoring tab content updated')
    isBusy.value = true
    apiError.value = null
    const api = new PostgSail()
    try {
      const response = await api.monitoring_live()
      if (Array.isArray(response) && response[0]) {
        console.debug(response[0])
        api_monitoring.value = response[0]
      } else {
        console.warn('monitoring', response)
        //throw { response }
      }
    } catch ({ response }) {
      console.debug(response)
      apiError.value = t('monitoring.error')
      if (!import.meta.env.PROD) {
        console.warn('Fallback using sample data from local json...', apiError.value)
        // TODO
      }
    } finally {
      isBusy.value = false
    }
  }

  const items = computed(() => {
    console.debug('items api_monitoring', api_monitoring.value)
    return api_monitoring.value
      ? {
          time: dateFormatUTC(api_monitoring.value.time),
          updated: fromNow(api_monitoring.value.time),
          wind: {
            speed: isNaN(api_monitoring.value.windspeedoverground)
              ? null
              : utils.metersToKnots(api_monitoring.value.windspeedoverground),
            direction: utils.radiantToDegrees(api_monitoring.value.winddirectiontrue) || null,
          },
          temperature: {
            inside: kelvinToHuman(api_monitoring.value.insidetemperature) || null,
            outside: kelvinToHuman(api_monitoring.value.outsidetemperature) || null,
          },
          water: {
            depth: depthFormatI18n(api_monitoring.value.depth) || null,
            temperature: kelvinToHuman(api_monitoring.value.watertemperature) || null,
          },
          battery: {
            charge: floatToPercentage(api_monitoring.value.batterycharge) || null,
            voltage: parseFloat(api_monitoring.value.batteryvoltage).toFixed(1) || null,
          },
          humidity: {
            inside: floatToPercentage(api_monitoring.value.insidehumidity) || null,
            outside: floatToPercentage(api_monitoring.value.outsidehumidity) || null,
          },
          pressure: {
            inside: pascalToHectoPascal(api_monitoring.value.insidepressure) || null,
            outside: pascalToHectoPascal(api_monitoring.value.outsidepressure) || null,
          },
          solar: {
            voltage: parseFloat(api_monitoring.value.solarvoltage).toFixed(1) || null,
            power: isNaN(api_monitoring.value.solarpower) ? null : parseInt(api_monitoring.value.solarpower), // 0 is treat as false
          },
          tank: {
            level: floatToPercentage(api_monitoring.value.tanklevel) || null,
          },
          outsidepressurehistory: api_monitoring.value.outsidepressurehistory || null,
          vessel_name: api_monitoring.value.name,
          status: api_monitoring.value.status,
          geojson: api_monitoring.value.geojson,
          live: api_monitoring.value.live,
          alarm: GlobalStore.settings.preferences.alerting,
          offline: api_monitoring.value.offline,
        }
      : {}
  })

  const getSpeedColor = (speed) => {
    if (speed <= 10) return '#91cc75'
    if (speed <= 20) return '#fac858'
    return '#ee6666'
  }
  const circumference = 2 * Math.PI * 45 // r = 38 now
  const dashArray = computed(() => {
    if (!items.value?.wind?.speed) return `0, ${circumference}`
    return `${(items.value.wind.speed / 30) * circumference}, ${circumference}`
  })

  // Watch for changes in dateArray and update selectedRange accordingly
  watch(filter, (newValue) => {
    console.debug('newValue filter', newValue)
    updateMap()
  })

  const displayMonitoring = () => {
    if (!items.value.live || (!items.value.live.geometry && !items.value.live.features)) {
      console.debug('Live items not ready yet')
      return
    }

    // Remove all existing layers from map
    logsLayers.value.forEach((layer) => map.value.removeLayer(layer))
    mooragesLayers.value.forEach((layer) => map.value.removeLayer(layer))

    const boatTypes = boatMarkerTypes()
    const boatIcon = vesselType === 'Sailing' ? boatTypes['Sailboat'] : boatTypes['Powerboat']
    // Add boat layer
    const boat = L.geoJSON(items.value.live, {
      pointToLayer: boatIcon,
      onEachFeature: onBoatFeaturePopup,
    })
    map.value.addLayer(boat)
    if (boat.getBounds().isValid()) {
      map.value.fitBounds(boat.getBounds(), { animate: true, duration: 0.5, padding: [30, 30], maxZoom: 17 })
    }

    console.debug('displayMonitoring done')
  }

  watch(
    () => items.value.live,
    (newVal) => {
      if (newVal) {
        console.debug('items.value.live', newVal)
        displayMonitoring()
      }
    },
  )
  const onBoatFeaturePopup = function (feature, layer) {
    //console.debug('onBoatFeaturePopup', feature)
    var popupContent = '<p>I started out as a GeoJSON ' + feature.geometry.type + ", but now I'm a Leaflet vector!</p>"
    if (feature.properties.stay_code) {
      // moorage point live stay
      let latitude = parseFloat(feature.geometry.coordinates[0].toFixed(3))
      let longitude = parseFloat(feature.geometry.coordinates[1].toFixed(3))
      let dmsCoords = decimalToDMS(latitude, longitude)
      let text = `<div class='mpopup'><br/><h4>${vesselName}</h4><br/>
                          <table class='data'><tbody>`
      if (vesselImage) {
        text += `<img src="${vesselImage}" alt="${vesselName}" class="vessel-image" />`
      }
      text += `<tr><th>Time</th><td>${dateFormatUTC(feature.properties.time)}</td></tr>
                            <tr><th>Position</th><td>${dmsCoords.toString()}</td></tr>`
      let stay_type = 'At Unknown in '
      if (feature.properties.stay_code == 2) {
        stay_type = 'At anchor in '
      }
      if (feature.properties.stay_code == 3) {
        stay_type = 'At mooring buoy in '
      }
      if (feature.properties.stay_code == 4) {
        stay_type = 'At dock in '
      }
      text += `<tr><th>Updated</th><td>${fromNow(feature.properties.time)}`
      text += `<tr><th>Status</th><td>${stay_type} ${feature.properties.name}`
      text += `<tr><th>Arrived at</th><td>${dateFormatUTC(feature.properties.arrived)}`
      text += `<tr><th>Arrived</th><td>${fromNow(feature.properties.arrived)}`
      if (vesselModel) {
        text += `<tr><th>Make & Model</th><td>${vesselModel}`
      }
      text += '</tbody></table></br></div>'
      popupContent = text
    } else if (feature.properties.status) {
      // moorage point + current linestring live trip
      let starttime = dateFormatUTC(feature.properties.time)
      let duration = durationFromNow(feature.properties.time)
      let distance = distanceFormatMiles(feature.properties.distance) || ''
      let sog = speedFormatKnots(feature.properties.speedoverground)
      let cog = angleFormat(feature.properties.courseovergroundtrue)
      let twd = angleFormat(feature.properties.truewinddirection)
      let aws = speedFormatKnots(feature.properties.windspeedapparent)
      let awa = awaFormat(feature.properties.truewinddirection, feature.properties.courseovergroundtrue)
      let latitude = parseFloat(feature.geometry.coordinates[0].toFixed(3))
      let longitude = parseFloat(feature.geometry.coordinates[1].toFixed(3))
      let dmsCoords = decimalToDMS(latitude, longitude)
      popupContent = `<div class='mpopup'><h4>${vesselName}</h4><br/>`
      if (vesselImage) {
        popupContent += `<img src="${vesselImage}" alt="${vesselName}" class="vessel-image" />`
      }
      popupContent += `<table class='data'><tbody>
                        <tr><th>Start Time</th><td>${starttime}</td></tr>
                        <tr><th>Updated</th><td>${fromNow(feature.properties.time)}</td></tr>
                        <tr><th>Distance</th><td>${distance}</td></tr>
                        <tr><th>Duration</th><td>${duration}</td></tr>
                        <tr><th>Speed</th><td>${cog} / ${sog}</td></tr>
                        <tr><th>Wind</th><td>${aws} / ${twd}</td></tr>
                        <tr><th>AWA</th><td>${awa}</td></tr>
                        <tr><th>Position</th><td>${dmsCoords}</td></tr>`
      if (vesselModel) {
        popupContent += `<tr><th>Make & Model</th><td>${vesselModel}`
      }
      popupContent += `</tbody></table></br>
                    </div>`
    }
    layer.bindPopup(popupContent, {
      autoPan: true,
      autoPanPadding: L.point(30, 30),
    })
  }

  const statusColor = computed(() => {
    return items.value.offline ? 'orange' : 'green'
  })

  function deleteChip(chip) {
    filter.tags = filter.tags.filter((v) => v !== chip)
  }

  onBeforeUnmount(async () => {
    if (map.value) {
      map.value.remove()
    }
  })
</script>

<template>
  <template v-if="apiError">
    <va-alert color="danger" outline class="mb-4">{{ $t('api.error') }}: {{ apiError }}</va-alert>
  </template>
  <va-inner-loading v-if="logsList.length > 0 || isBusy" :loading="isBusy">
    <div class="explore-maps leaflet-map__full">
      <div>
        <div id="sidepanel" class="sidepanel" aria-label="side panel" aria-hidden="false">
          <div class="sidepanel-inner-wrapper">
            <nav class="sidepanel-tabs-wrapper" aria-label="sidepanel tab navigation">
              <ul class="sidepanel-tabs">
                <li class="sidepanel-tab">
                  <a href="#" class="sidebar-tab-link" role="tab" data-tab-link="tab-1" @click="onLogsTabClick">
                    <va-icon name="timeline" />
                  </a>
                </li>
                <li class="sidepanel-tab">
                  <a href="#" class="sidebar-tab-link" role="tab" data-tab-link="tab-2" @click="onMooragesTabClick">
                    <va-icon name="anchor" />
                  </a>
                </li>
                <li class="sidepanel-tab">
                  <a href="#" class="sidebar-tab-link" role="tab" data-tab-link="tab-3" @click="onMonitoringTabClick">
                    <va-icon name="my_location" />
                  </a>
                </li>
              </ul>
            </nav>
            <div class="sidepanel-content-wrapper">
              <div class="sidepanel-content">
                <div id="logs-list" class="sidepanel-tab-content" data-tab-content="tab-1">
                  <div>
                    <ol>
                      <li class="line-item" v-if="logsList.length > 0" v-for="(log, index) in logsList" :key="index">
                        {{ index + 1 }}.
                        <a
                          class="va-link"
                          @mouseenter="onLogMouseEnter(log.properties.logIndex)"
                          @click="onLogClickNavigate(log.properties.centercoords, log.properties.logIndex)"
                          >{{ log.properties.name }} • {{ durationFormatHours(log.properties.duration) }} h •
                          {{ distanceFormatMiles(log.properties.distance) }}
                        </a>
                      </li>
                    </ol>
                    <hr class="cool-hr" />
                    <div v-if="logsList.length > 0" class="stats-list">
                      <div class="stat-line">
                        <strong>{{ $t('stats.count') }}:</strong> {{ stats.logs.count }}
                      </div>
                      <div class="stat-line">
                        <strong>{{ $t('stats.sum_duration') }}:</strong> {{ stats.logs.duration }}
                      </div>
                      <div class="stat-line">
                        <strong>{{ $t('stats.sum_distance') }}:</strong> {{ stats.logs.distance }}
                      </div>
                    </div>
                  </div>
                </div>
                <div id="moorages-list" class="sidepanel-tab-content" data-tab-content="tab-2">
                  <div>
                    <ol>
                      <li
                        class="line-item"
                        v-if="mooragesList.length > 0"
                        v-for="(moorage, index) in mooragesList"
                        :key="index"
                      >
                        {{ index + 1 }}.
                        <img :src="moorage.properties.iconUrl" style="height: 24px; width: 24px" />
                        <a
                          class="va-link"
                          @mouseenter="onMoorageMouseEnter(moorage.properties.moorageIndex)"
                          @mouseleave="stopBouncingMarker(moorage.properties.moorageIndex)"
                          @click="onMoorageClickNavigate(moorage.geometry.coordinates, moorage.properties.moorageIndex)"
                          >{{ moorage.properties.name }}</a
                        >
                      </li>
                    </ol>
                  </div>
                </div>
                <div id="real-time" class="sidepanel-tab-content" data-tab-content="tab-3">
                  <div class="w-full" v-if="items">
                    <h2 class="flex items-center gap-2">
                      {{ items.updated }} <span class="dot" :style="{ backgroundColor: statusColor }"></span>
                      <VaImage :src="`/realtime.svg`" class="w-6 h-6 inline-block align-middle" />
                    </h2>
                    <hr class="cool-hr" />
                    <h3 class="font-semibold">Wind & Depth</h3>
                    <div class="w-full flex justify-center items-center">
                      <div
                        class="flex items-center space-x-4"
                        v-if="items.wind.speed !== null && items.wind.speed !== undefined"
                      >
                        <!-- Left Column -->
                        <div class="flex flex-col text-sm space-y-1 min-w-[100px]">
                          <div>Wind Speed: {{ speedFormatKnots(items.wind.speed) }}</div>
                          <div>Wind Direction: {{ angleFormat(items.wind.direction) }}</div>
                          <div>Depth: {{ depthFormatI18n(items.water.depth) }}</div>
                        </div>

                        <!-- Right Column (Wind Compass) -->
                        <div
                          class="wind-compass group relative"
                          :title="`Wind: ${items.wind.speed} Kt, ${items.wind.direction} deg`"
                        >
                          <!-- Circular wind speed ring -->
                          <svg class="speed-circle" viewBox="0 0 100 100">
                            <circle class="bg" cx="50" cy="50" r="45" />
                            <circle
                              class="progress"
                              :stroke="getSpeedColor(items.wind.speed)"
                              cx="50"
                              cy="50"
                              r="45"
                              :stroke-dasharray="dashArray"
                              stroke-dashoffset="0"
                            />
                          </svg>

                          <!-- Rotating Arrow -->
                          <svg
                            class="arrow-svg"
                            :style="{ transform: `rotate(${items.wind.direction}deg)` }"
                            viewBox="0 0 36 36"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              x="3"
                              y="3"
                              width="25"
                              height="25"
                              transform="rotate(-249.5,15.5,15.5)"
                              fill="#145da0"
                              d="M26.675824776131577 2.519999999999989L2.500000600307402 13.822982731554148 2.500000600307402 14.764897959183662 10.46703356734037 18.728791208791197ZM11.291209391516192 19.55296703296702L15.25510264112373 27.51999999999999 16.197017868753242 27.51999999999999 27.500000600307402 3.3441758241758133Z"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <hr class="cool-hr" />
                    <h3 class="font-semibold">Temperature</h3>
                    <div class="w-full h-24" v-if="items.temperature.inside">
                      <echartsProgress
                        :series="[items.temperature.inside]"
                        title="Inside"
                        :alarm="items.alarm.low_indoor_temperature_threshold"
                      />
                    </div>
                    <div class="w-full h-24" v-if="items.temperature.outside">
                      <echartsProgress
                        :series="[items.temperature.outside]"
                        title="Outside"
                        :alarm="items.alarm.low_outdoor_temperature_threshold"
                      />
                    </div>
                    <div class="w-full h-24" v-if="items.water.temperature">
                      <echartsProgress
                        :series="[items.water.temperature]"
                        title="Water"
                        :alarm="items.alarm.low_water_temperature_threshold"
                      />
                    </div>
                    <hr class="cool-hr" />
                    <h3 class="font-semibold">Humidity</h3>
                    <div class="w-full h-24" v-if="items.humidity.inside">
                      <echartsProgress :series="[items.humidity.inside]" title="Inside" :max="100" unit="%" />
                    </div>
                    <div class="w-full h-24" v-if="items.humidity.outside">
                      <echartsProgress :series="[items.humidity.outside]" title="Outside" :max="100" unit="%" />
                    </div>
                    <template v-if="items.outsidepressurehistory">
                      <hr class="cool-hr" />
                      <h3 class="font-semibold">Barometer</h3>
                      <div class="w-full h-28">
                        <echartsPressure :series="items.outsidepressurehistory" title="Outside" />
                      </div>
                    </template>
                    <template v-if="items.battery.charge">
                      <hr class="cool-hr" />
                      <h3 class="font-semibold">Battery</h3>
                      <div class="w-full h-28">
                        <echartsGauge :series="[items.battery.charge, items.battery.voltage]" />
                      </div>
                    </template>
                    <template v-if="items.solar.power">
                      <hr class="cool-hr" />
                      <h3 class="font-semibold">Solar</h3>
                      <div class="w-full h-28">
                        <echartsGauge
                          :series="[items.solar.power, items.solar.voltage]"
                          :max="items.solar.power + 50"
                          unit="W"
                        />
                      </div>
                    </template>
                    <template v-if="items.tank.level">
                      <hr class="cool-hr" />
                      <h3 class="font-semibold">Tank</h3>
                      <div class="w-full h-28">
                        <echartsGauge :series="[items.tank.level, items.tank.level]" unit="%" />
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="sidepanel-toggle-container">
            <button class="sidepanel-toggle-button" type="button" aria-label="toggle side panel"></button>
          </div>
        </div>
        <div id="explore-map" class="leaflet-map"></div>
      </div>
    </div>
    <template v-if="logsSlider.length > 1">
      <div class="map-controls">
        <div class="date-slider">
          <va-slider
            v-model="filter.dateRange"
            :range="true"
            :min="0"
            :max="logsSlider.length - 1"
            :step="1"
            show-markers
            :tooltip="true"
            :tooltip-label="tooltipLabel"
          />
          {{ formattedDateRange }}
        </div>

        <div class="tag-selector py-2">
          <va-select
            v-model="filter.tags"
            :placeholder="$t('logs.list.filter.tags')"
            :options="logsTags"
            multiple
            text-by="text"
            style="width: 90%"
          >
            <template #content="{ value }">
              <va-chip
                v-for="chip in value"
                :key="chip.text"
                size="small"
                class="xs-chip mr-2"
                outline
                closeable
                @update:modelValue="deleteChip(chip)"
              >
                {{ chip }}
              </va-chip>
            </template>
          </va-select>
        </div>
      </div>
    </template>
  </va-inner-loading>
</template>

<style lang="scss">
  $map-height: calc(91vh - 3.5rem);
  $map-height-mobile: calc(80vh - 3rem);

  .leaflet-map {
    z-index: 0;
    width: 100%;
    height: $map-height;
    @media (max-width: 768px) {
      height: $map-height-mobile;
    }
  }
  .sidepanel {
    z-index: 10;
    width: 320px;
    height: $map-height;
    @media (max-width: 768px) {
      height: $map-height-mobile;
    }
    .sidepanel-content {
      width: 320px;
      height: $map-height;
      @media (max-width: 768px) {
        height: $map-height-mobile;
      }
    }
  }
  .sidebar-tab-link.active,
  .sidebar-tab-link:hover {
    color: var(--va-primary) !important;
    border-bottom-color: var(--va-primary) !important;
  }
  .date-slider {
    color: var(--va-primary) !important;
    padding: 0.5rem 2rem 0.5rem 2rem;
  }
  .mpopup {
    width: 210px;
    th {
      text-align: right;
      padding-right: 5px;
      font-weight: bold;
    }
    td {
      font-weight: normal;
    }
    a {
      cursor: pointer;
    }
    h4 {
      font-weight: bold;
    }
  }
  .line-item {
    display: flex;
    //align-items: center;
    gap: 4px; /* Adds spacing between elements */
  }
  .line-item:hover {
    background-color: yellow;
  }
  .bouncing {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background-color: #ff5722;
  }

  @keyframes bounce {
    from {
      transform: translate3d(0, 0, 0);
    }

    to {
      transform: translate3d(0, 200px, 0);
    }
  }

  .wind-compass {
    position: relative;
    width: 80px;
    height: 80px;
  }

  .speed-circle {
    width: 80px;
    height: 80px;
    transform: rotate(-90deg);
  }

  circle.bg {
    fill: none;
    stroke: #eee;
    stroke-width: 12;
  }

  circle.progress {
    fill: none;
    stroke-width: 12;
    transition: stroke 0.3s;
  }

  .arrow-svg {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 56px;
    height: 56px;
    opacity: 0.8;
    transition: transform 0.5s ease;
    transform-origin: center center;
  }

  .dot {
    display: inline-block; /* Ensures it's on the same line as the text */
    width: 10px; /* Size of the dot */
    height: 10px; /* Size of the dot */
    //background-color: green; /* Green color for the dot */
    border-radius: 50%; /* Makes it circular */
    animation: pulseAnimation 1s infinite; /* Makes it pulse */
    margin-left: 10px; /* Adds space between the text and the dot */
  }

  @keyframes pulseAnimation {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.5); /* Increase the size slightly */
      opacity: 0.6;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  .cool-hr {
    margin: 5px;
  }
  .map-controls {
    position: absolute;
    //bottom: 10px;
    left: 0;
    width: 100%;
    display: flex;
    justify-content: space-between;
    padding: 0 20px;
    z-index: 1000; /* Make sure it's above Leaflet map */
  }

  .date-slider {
    flex: 1;
  }

  .tag-selector {
    margin-left: 20px;
    width: 300px;
  }

  .va-input-wrapper__field.va-input-wrapper__text.va-input__content__input {
    z-index: 9999 !important;
  }
  .va-dropdown__content.va-select-dropdown__content.va-dropdown__content-wrapper {
    z-index: 9999 !important;
  }
  .vessel-image {
    display: block;
    margin: 0 auto 10px auto; /* Centers the image and adds space below */
    width: 180px; /* Fixed width */
    height: auto; /* Maintain aspect ratio */
    object-fit: contain; /* Ensures it fits within bounds without distortion */
    border-radius: 4px; /* Optional: rounds corners slightly */
  }
</style>
