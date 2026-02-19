<template>
  <div ref="chartContainer" class="graph-chart" :theme="themeOption" autoresize></div>
</template>

<script setup>
  /*
weightBy: 'frequency' | 'distance' | 'duration'
// What metric determines link thickness/value
// - 'frequency': thicker = more trips between moorages
// - 'distance': thicker = more nautical miles traveled
// - 'duration': thicker = more hours spent traveling

minTrips: number
// Minimum number of trips to show a route
// Example: minTrips=2 hides routes you've only done once
*/
  import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
  import VChart, { THEME_KEY } from 'vue-echarts'
  import { init } from 'echarts/core'
  import { GraphChart } from 'echarts/charts'
  import { TitleComponent, TooltipComponent } from 'echarts/components'
  import { CanvasRenderer } from 'echarts/renderers'
  import * as echarts from 'echarts/core'

  // Register components
  echarts.use([GraphChart, TitleComponent, TooltipComponent, CanvasRenderer])

  const props = defineProps({
    logs: {
      type: Array,
      required: true,
      default: () => [],
    },
    // Determines what makes routes "heavier" (thicker lines)
    // Options: 'frequency' (trip count), 'distance' (nm), 'duration' (hours)
    weightBy: {
      type: String,
      default: 'frequency',
      validator: (v) => ['frequency', 'distance', 'duration'].includes(v),
    },
    // Only show routes with at least this many trips
    minTrips: {
      type: Number,
      default: 1,
    },
    // Show/hide node labels
    showLabels: {
      type: Boolean,
      default: true,
    },
    theme: {
      type: String,
      default: THEME_KEY.LIGHT,
    },
  })

  const chartContainer = ref(null)
  let chartInstance = null

  const parseDuration = (durationStr) => {
    if (!durationStr) return 0
    const regex = /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/
    const matches = durationStr.match(regex)
    if (!matches) return 0

    const days = parseInt(matches[1] || 0)
    const hours = parseInt(matches[2] || 0)
    const minutes = parseInt(matches[3] || 0)
    const seconds = parseFloat(matches[4] || 0)

    return days * 24 + hours + minutes / 60 + seconds / 3600
  }

  const processGraphData = () => {
    const routeMap = new Map()
    const moorageStats = new Map()

    props.logs.forEach((log) => {
      if (!log.from || !log.to) return // Track moorage visit counts
      ;[log.from, log.to].forEach((moorage) => {
        if (!moorageStats.has(moorage)) {
          moorageStats.set(moorage, { visits: 0 })
        }
        moorageStats.get(moorage).visits++
      })

      const routeKey = `${log.from}→${log.to}`

      if (!routeMap.has(routeKey)) {
        routeMap.set(routeKey, {
          source: log.from,
          target: log.to,
          count: 0,
          totalDistance: 0,
          totalDuration: 0,
        })
      }

      const route = routeMap.get(routeKey)
      route.count += 1
      route.totalDistance += log.distance || 0
      route.totalDuration += parseDuration(log.duration)
    })

    // Create nodes
    const nodes = Array.from(moorageStats.entries()).map(([name, stats]) => ({
      id: name,
      name: name,
      symbolSize: Math.max(20, Math.min(80, stats.visits * 3)),
      value: stats.visits,
      itemStyle: {
        color: getNodeColor(name),
      },
      label: {
        show: props.showLabels,
      },
    }))

    // Create links
    const links = Array.from(routeMap.values())
      .filter((route) => route.count >= props.minTrips)
      .map((route) => {
        let value

        switch (props.weightBy) {
          case 'distance':
            value = route.totalDistance
            break
          case 'duration':
            value = route.totalDuration
            break
          case 'frequency':
          default:
            value = route.count
        }

        return {
          source: route.source,
          target: route.target,
          value: value,
          count: route.count,
          distance: route.totalDistance,
          duration: route.totalDuration,
          lineStyle: {
            width: Math.max(1, Math.min(10, route.count / 2)),
            curveness: 0.3,
          },
        }
      })

    return { nodes, links }
  }

  const getNodeColor = (name) => {
    const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  const initChart = () => {
    if (!chartContainer.value) return
    chartInstance = init(chartContainer.value)
    updateChart()
    window.addEventListener('resize', handleResize)
  }

  const updateChart = () => {
    if (!chartInstance) return

    const { nodes, links } = processGraphData()

    const option = {
      /*
    title: {
      text: 'Sailing Routes Network',
      subtext: 'Node size = visits • Line width = frequency',
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'normal'
      }
    },
    */
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.dataType === 'edge') {
            return `
            <strong>${params.data.source} → ${params.data.target}</strong><br/>
            <strong>Trips:</strong> ${params.data.count}<br/>
            <strong>Distance:</strong> ${params.data.distance.toFixed(1)} nm<br/>
            <strong>Duration:</strong> ${params.data.duration.toFixed(1)} hrs
          `
          } else {
            return `
            <strong>${params.data.name}</strong><br/>
            <strong>Visits:</strong> ${params.data.value}
          `
          }
        },
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: nodes,
          links: links,
          roam: true, // Enable zoom & pan
          draggable: true, // Drag nodes
          force: {
            repulsion: 200, // Higher = nodes spread apart more
            gravity: 0.1, // Higher = nodes pulled to center more
            edgeLength: [100, 200], // Preferred distance between connected nodes
            layoutAnimation: true,
          },
          label: {
            show: props.showLabels,
            position: 'right',
            formatter: '{b}',
          },
          lineStyle: {
            color: 'source',
            curveness: 0.3,
            opacity: 0.6,
          },
          emphasis: {
            focus: 'adjacency', // Highlight connected routes on hover
            lineStyle: {
              width: 4,
            },
          },
        },
      ],
    }

    chartInstance.setOption(option, true)
  }

  const handleResize = () => {
    if (chartInstance) {
      chartInstance.resize()
    }
  }

  onMounted(() => {
    initChart()
  })

  onUnmounted(() => {
    if (chartInstance) {
      chartInstance.dispose()
      chartInstance = null
    }
    window.removeEventListener('resize', handleResize)
  })

  watch(
    () => [props.logs, props.weightBy, props.minTrips, props.showLabels],
    () => {
      updateChart()
    },
    { deep: true },
  )
  const themeOption = computed(() => {
    return props.theme || THEME_KEY.LIGHT
  })
</script>

<style scoped>
  .graph-chart {
    width: 100%;
    height: 600px;
    min-height: 400px;
  }
</style>
