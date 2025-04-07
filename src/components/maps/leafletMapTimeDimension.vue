<template>
  <div id="mapContainer"></div>
</template>

<script>
  import 'leaflet/dist/leaflet.css'
  import 'leaflet-timedimension/dist/leaflet.timedimension.control.min.css'
  import L from 'leaflet'
  import 'leaflet-rotatedmarker'
  import 'leaflet-timedimension'

  export default {
    name: 'LeafletMap',
    props: {
      geoJsonFeatures: {
        type: Object,
        default: null,
      },
    },
    data() {
      return {
        map: null,
      }
    },
    mounted() {
      if (!this.geoJsonFeatures) return

      // Center the map using the midpoint of the first feature
      const firstFeature = this.geoJsonFeatures.features[0]
      if (!firstFeature || !firstFeature.geometry.coordinates.length) return

      const midPoint = Math.floor(firstFeature.geometry.coordinates.length / 2)
      const centerLat = firstFeature.geometry.coordinates[midPoint][1]
      const centerLng = firstFeature.geometry.coordinates[midPoint][0]

      this.map = L.map('mapContainer', {
        zoom: 12,
        center: [centerLat, centerLng],
        timeDimension: true,
        // timeDimensionOptions: {
        //   timeInterval: `${start}/${end}`,
        //   period: 'PT1M',
        // },
        timeDimensionControl: true,
      })

      const basemaps = {
        OSM: L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }),
        Satellite: L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            attribution:
              'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 17,
          },
        ),
        NOAA: L.tileLayer('https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png', {
          attribution: 'NOAA',
          maxZoom: 18,
        }),
        'Emodnet bathymetry': L.tileLayer('https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png', {
          attribution:
            'Emodnet bathymetry, &copy; Esri, HERE, DeLorme, MapmyIndia, &copy; OpenStreetMap contributors, and the GIS user community ',
          maxZoom: 18,
        }),
      }
      L.control.layers(basemaps).addTo(this.map)
      basemaps['Satellite'].addTo(this.map)

      const sailBoatIcon = function (feature, latlng) {
        return L.marker(latlng, {
          icon: new L.Icon({
            iconSize: [15, 30],
            iconAnchor: [7.5, 10],
            iconUrl: '/sailboaticon.png',
          }),
          rotationAngle: feature.properties.courseovergroundtrue,
        })
      }

      // Extract all geometry Point from geojson to get a list of moorage geojson feature for map
      const geojson = this.geoJsonFeatures
      const logPoints = geojson.features
        .filter((feature) => feature.geometry.type === 'Point')
        .map((feature) => feature)
      const logLine = geojson.features
        .filter((feature) => feature.geometry.type === 'LineString')
        .map((feature) => feature)

      // Draw the GeoJSON LineString with speed-based colors
      this.drawLineWithSpeedMarkers(this.geoJsonFeatures)

      const geoJSONLayer = L.geoJSON(logLine, {
        pointToLayer: sailBoatIcon,
      })

      const geoJSONTDLayer = L.timeDimension.layer
        .geoJson(geoJSONLayer, {
          updateTimeDimension: true,
          // duration: 'PT2M',
          updateTimeDimensionMode: 'replace',
          addlastPoint: true,
        })
        .addTo(this.map)

      const timeDimensionControl = L.control.timeDimension({
        loopButton: true,
        autoPlay: false,
        timeZones: ['Local', 'UTC'],
      })

      this.map.fitBounds(geoJSONLayer.getBounds())
    },
    methods: {
      drawLineWithSpeedMarkers(geoJsonData) {
        const lineFeature = geoJsonData.features.find((feature) => feature.geometry.type === 'LineString')
        if (!lineFeature) return

        const coordinates = lineFeature.geometry.coordinates
        const speeds = geoJsonData.features
          .filter((feature) => feature.geometry.type === 'Point')
          .map((feature) => feature.properties.speedoverground)

        // Create a multi-colored polyline based on speed
        const latlngs = coordinates.map(([lng, lat]) => [lat, lng])
        const segments = []

        for (let i = 0; i < latlngs.length - 1; i++) {
          const speed = speeds[i] || 0 // Get speed or default to 0
          const color = this.getSpeedColor(speed)

          segments.push(
            L.polyline([latlngs[i], latlngs[i + 1]], {
              color,
              weight: 4,
              opacity: 1,
            }).addTo(this.map),
          )
        }
      },
      getSpeedColor(speed) {
        // RampColor logic to assign color based on speed
        const scaleLinear = (value, inputMin, inputMax, outputMin, outputMax) => {
          const normalized = (value - inputMin) / (inputMax - inputMin)
          return outputMin + normalized * (outputMax - outputMin)
        }

        const scaledValue = scaleLinear(speed, 0, 10, 0, 1) // Assuming speed ranges from 0 to 10

        const colors = ['#d73027', '#fc8d59', '#fee090', '#91bfdb', '#4575b4'] // RdYlBu
        const index = Math.min(Math.floor(scaledValue * (colors.length - 1)), colors.length - 1)
        return colors[index]
      },
    },
    onBeforeUnmount() {
      if (this.map) {
        this.map.remove()
      }
    },
  }
</script>

<style scoped>
  #mapContainer {
    z-index: 0;
    height: 100vh;
    width: 100%;
  }
</style>
