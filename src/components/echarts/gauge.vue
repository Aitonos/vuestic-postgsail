<script setup>
  import { ref, computed } from 'vue'
  import VChart, { THEME_KEY } from 'vue-echarts'
  import { use } from 'echarts/core'
  import { GaugeChart } from 'echarts/charts'
  import { TooltipComponent, LegendComponent } from 'echarts/components'
  import { CanvasRenderer } from 'echarts/renderers'

  use([TooltipComponent, LegendComponent, GaugeChart, CanvasRenderer])

  const props = defineProps({
    series: {
      type: Array,
      required: true,
    },
    theme: {
      type: String,
      default: THEME_KEY.LIGHT,
    },
    unit: {
      type: String,
      default: '%',
    },
  })

  const defaultConfig = {
    tooltip: {
      formatter: function (params) {
        // Show tooltip for the Battery Level gauge
        if (params.seriesIndex === 0) {
          //return `Battery Level: ${params.value}%`
          return `${params.value}${props.unit}`
        }
        return 'n/a'
      },
    },
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        startAngle: 180,
        endAngle: 0,
        radius: '100%',
        center: ['50%', '70%'], // Move lower to fit voltage above
        splitNumber: 5,
        axisLine: {
          roundCap: true,
          lineStyle: {
            width: 12,
            color: [
              [1, '#eeeeee'], // Filled portion
              [1, '#ffffff'], // Background portion (white)
            ],
          },
        },
        axisLabel: {
          distance: -42, // Small distance now that it's outside arc
          fontSize: 14,
          color: '#333',
        },
        axisTick: {
          show: false,
        },
        splitLine: {
          show: false,
        },
        pointer: {
          show: false,
        },
        progress: {
          overlap: false, // ensures no extra fill on rounded edges
          roundCap: true,
          show: true,
          width: 15,
        },
        detail: {
          valueAnimation: true,
          formatter: '10V',
          fontSize: 26,
          fontWeight: 'bold',
          color: '#000',
          offsetCenter: [0, '10%'], // Move above the center of arc
        },
        data: [
          {
            value: 10,
          },
        ],
      },
    ],
  }

  const chartOptions = computed(() => {
    const localoptions = { ...defaultConfig }
    localoptions.series[0].data = [props.series[0]] || []
    localoptions.series[0].detail.formatter = props.series[1] + 'V'
    localoptions.backgroundColor = props.theme === 'dark' ? '#1f262f' : ''
    return localoptions
  })
  const themeOption = computed(() => {
    return props.theme || THEME_KEY.LIGHT
  })
</script>

<template>
  <div id="gauge">
    <v-chart :option="chartOptions" :theme="themeOption" autoresize />
  </div>
</template>

<style lang="scss">
  #gauge {
    width: 100%;
    height: 100%;
  }
</style>
