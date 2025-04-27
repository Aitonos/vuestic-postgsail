<script setup>
  const getSpeedColor = (speed) => {
    if (speed <= 10) return '#91cc75'
    if (speed <= 20) return '#fac858'
    return '#ee6666'
  }
</script>

<template>
  <div class="w-full">
    <h2 class="">{{ msg_fromNow }} <span class="dot"></span></h2>
    <hr />
    <h4 class="">Wind</h4>
    <div class="w-full flex justify-center items-center">
      <div class="wind-compass group relative" :title="`Wind: ${windSpeed} Kt, ${windDirection2} deg`">
        <!-- Value on top -->
        <div
          class="absolute -top-7 left-1/2 transform -translate-x-1/2 text-sm font-medium text-center px-1 max-w-[6rem] truncate"
        >
          {{ windSpeed }} Kt – {{ windDirection2 }}°
        </div>

        <!-- Circular wind speed ring -->
        <svg class="speed-circle" viewBox="0 0 100 100">
          <circle class="bg" cx="50" cy="50" r="45" />
          <circle
            class="progress"
            :stroke="getSpeedColor(windSpeed)"
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
          :style="{ transform: `rotate(${windDirection2}deg)` }"
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
          ></path>
        </svg>
      </div>
    </div>

    <hr />
    <h4>Temperature</h4>
    <div class="w-full h-28">
      <VChart :option="echartsTempInside" autoresize />
    </div>
    <div class="w-full h-28">
      <VChart :option="echartsTempOutside" autoresize />
    </div>
    <div class="w-full h-28">
      <VChart :option="echartsTempWater" autoresize />
    </div>
    <hr />
    <h4>Humidity</h4>
    <div class="w-full h-28">
      <VChart :option="echartsHumInside" autoresize />
    </div>
    <div class="w-full h-28">
      <VChart :option="echartsHumOutside" autoresize />
    </div>
    <hr />
    <h4>Battery</h4>
    <div class="w-full h-28">
      <VChart :option="echartsBattery" autoresize />
    </div>
    <h4>Solar</h4>
    <div class="w-full h-28">
      <VChart :option="echartsSolar" autoresize />
    </div>
    <h4>Tank</h4>
    <div class="w-full h-28">
      <VChart :option="echartsTank" autoresize />
    </div>
  </div>
</template>
