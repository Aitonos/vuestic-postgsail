<template>
  <div>
    <va-card class="layout mx-auto my-6 p-6">
      <va-card-title class="text-2xl font-bold text-primary mb-2"> 🚀 Support and Sponsor PostgSail </va-card-title>
      <va-card-content class="text-base leading-relaxed">
        <p class="mb-4">
          <strong>PostgSail</strong> is more than a project—it's a movement towards smarter, faster, and more intuitive
          spatial data experiences.
        </p>

        <p class="mb-4">
          We're building a powerful open-source tool that enhances PostgreSQL + PostGIS environments, empowering
          developers, researchers, and organizations to
          <strong>navigate, visualize, and optimize spatial data like never before</strong>.
        </p>

        <va-divider class="my-4" />

        <h3 class="text-xl font-semibold text-secondary mb-2">Why Sponsor PostgSail?</h3>
        <ul class="list-disc ml-5 mb-4 space-y-1">
          <li><strong>Innovative Impact</strong> – Cutting-edge tools for geospatial workflows.</li>
          <li><strong>Open-Source Values</strong> – Transparent, community-driven development.</li>
          <li><strong>Real-World Applications</strong> – Urban planning, logistics, mapping, and more.</li>
          <li><strong>Brand Visibility</strong> – Get recognized as a supporter of open innovation.</li>
        </ul>

        <h3 class="text-xl font-semibold text-secondary mb-2">What We Need</h3>
        <ul class="list-disc ml-5 mb-4 space-y-1">
          <li><strong>Financial Support</strong> – Help us fund development and documentation.</li>
          <li><strong>Infrastructure Resources</strong> – Cloud, servers, or development tools.</li>
          <li><strong>Community Ambassadors</strong> – Spread the word, contribute, or teach!</li>
        </ul>

        <va-divider class="my-4" />

        <p class="mb-4">
          By supporting PostgSail, you're not just backing a tool—you’re investing in the future of spatial intelligence
          and open innovation.
        </p>

        <p class="mb-6">
          <strong>👉 Let’s build this journey together.</strong>
        </p>

        <a href="mailto:info@openplotter.cloud?subject=PostgSail is great" target="_blank">
          <va-button color="primary" icon="email" to="mailto:info@openplotter.cloud" target="_blank">
            Contact Us
          </va-button>
        </a>
        <a href="https://github.com/sponsors/xbgmsharp" target="_blank">
          <va-button color="success" icon="sponsor" target="_blank"> Sponsor on GitHub </va-button></a
        >
      </va-card-content>
    </va-card>

    <va-card class="mb-3">
      <va-card-title> {{ $t('faq.desc') }} </va-card-title>
      <va-card-content class="layout gutter--md">
        <va-accordion>
          <va-collapse header="What is PostgSail">
            <p class="pa-3"></p>
            <p>
              PostgSail is a self-hosted or cloud based solution that is built by boaters for boaters. It automatically
              logs the details of your boat's trips. These include track, speed, distance, wind speed, etc. Each trip is
              automatically detected and logged without requiring you take any action like starting or stopping a trip.
            </p>
            <br />
            <p>
              At the end of each trip, a new log entry is automatically created, marking start and destination moorages.
              The time you spent at moorages will also be logged under Stays (e.g. Stayed 3 days in Eagle Harbor at
              anchor). You may need to manually categorize your stay as at anchor, mooring buoy or dock. If you choose
              to do so, that is the only manual thing to do, it is completely optional. And if you classify a stay,
              PostgSail will remember it the next time you visit the same moorage.
            </p>
            <br />
            <p>
              PostgSail aggregates information about your trips and provides you statistics including the number of
              trips, moorages you have been to, countries you have visited, longest passages, time you spent at anchor,
              mooring buoys etc. The easiest may be to look at the statistics of demo account as an example.
            </p>
            <br />
            <p>
              PostgSail also creates an automatic timelapse for all of your trips, animating the movements of your boat
              on a map. See a timelapse example here for a multi-week sail along the Canada coast from the demo account.
            </p>
            <br />
            <p>
              Your information stays private unless you explicitly decide to make it available publicly. If you choose
              to do so, your friends and others can access your logs, monitoring, statistics and timelapse.
            </p>
            <br />
          </va-collapse>
          <va-collapse header="Timelapse">
            <div class="pa-3">
              <p>
                Timelapse can be customized through several parameters:<br />
                <br />
                - color: Specifies the path color. Default: dodgerblue<br />
                - start_log and end_log: Specified in the log entry. Default: None<br />
                - start_date and end_date: Specified in whatever format (YYYY-MM-DD, DD-MM-YYYY). Default: None<br />
                - map_type: 0 for OpenStreetMap, 1 for Satellite, 2 for NOAA (for US only). Default: OpenStreetMap<br />
                - speed: Measured in milliseconds, controls the speed of animation. Lower values mean faster movement.
                Default: 75<br />
                - delay: Measured in seconds, allows pausing before starting the animation for screen captures. Default:
                0<br />
                - zoom: Specifies default zoom. Default: 10<br />
                <br />
                Example:
                <a
                  href="https://iot.openplotter.cloud/Elysian/timelapse?color=yellow&start_date=2021-05-01&end_date=2021-11-01&map_type=1&speed=90&delay=1&zoom=11"
                  target="_blank"
                  >https://iot.openplotter.cloud/Elysian/timelapse?color=yellow&start_date=2021-05-01&end_date=2021-11-01&map_type=1&speed=90&delay=1&zoom=11
                  <va-icon name="fa-external-link" size="small"
                /></a>
              </p>
            </div>
          </va-collapse>
          <va-collapse header="Time, Distance, Temperatures, Depth Units">
            <div class="pa-3">
              All times are stored in UTC. They are converted to local time within the user interface.<br />
              All distances are stored in Nautical Miles. The user interface displays them directly in the same unit.<br />
              All temperatures are stored in Kelvin. By default, they are converted to Celsius for display. To show
              Fahrenheit instead, enable "Use Imperial Units."<br />
              All depth values are stored in Meters. By default, they are shown in Meters, but can be converted to Feet
              by enabling "Use Imperial Units."<br />
              Check the
              <router-link class="va-text-bold va-link link" :to="{ name: 'explore' }">explore page</router-link> to see
              your signalk path.
            </div>
          </va-collapse>
          <va-collapse header="No metrics, why?">
            <div class="pa-3">
              <p>
                Postgsail ignores all metrics that do not provide valid GPS coordinates. Ensure your GPS device is
                connected to your OpenPlotter and that GPS data is being sent to the SignalK server.
                <br />
                Postgsail ignores all metrics with timestamps in the future. Make sure your system time is synchronized
                with GPS or an NTP server.
                <br />
                Postgsail ignores all metrics dated earlier than the last entry.
                <br />
                Postgsail ignores all metrics with an invalid status.
                <br />
                Postgsail ignores all metrics where the Speed Over Ground (SOG) exceeds 40 knots.<br />
              </p>
            </div>
          </va-collapse>
          <va-collapse header="Energy">
            <div class="pa-3">
              <p>
                The energy widget search for the following pattern from your Signalk metrics:<br />
                - electrical.batteries.*.stateOfCharge<br />
                - electrical.solar.*.panelPower<br />
                - electrical.batteries.*.current<br />
                - electrical.batteries.*.voltage<br />
                - tanks.*.currentLevel.*<br />
                Check the
                <router-link class="va-text-bold va-link link" :to="{ name: 'explore' }">explore page</router-link> to
                see your signalk path.<br />
                You can setup the monitoring path you want to use for the energy widget in the
                <router-link class="va-text-bold va-link link" :to="{ name: 'boat-profile' }"
                  >boat correlation page</router-link
                >.
              </p>
            </div>
          </va-collapse>
          <va-collapse header="Monitoring">
            <div class="pa-3">
              <p>
                Monitoring and History pages use the following path from Signalk:<br />
                - 'environment.water.temperature' AS waterTemperature<br />
                - 'environment.inside.temperature' AS insideTemperature<br />
                - 'environment.outside.temperature' AS outsideTemperature<br />
                - 'environment.wind.speedOverGround' AS windSpeedOverGround<br />
                - 'environment.wind.directionTrue' AS windDirectionTrue<br />
                - 'environment.inside.relativeHumidity' AS insideHumidity<br />
                - 'environment.outside.relativeHumidity' AS outsideHumidity<br />
                - 'environment.outside.pressure' AS outsidePressure<br />
                - 'environment.inside.pressure' AS insidePressure<br />
                - 'electrical.batteries.House.capacity.stateOfCharge' AS batteryCharge<br />
                - 'electrical.batteries.House.voltage' AS batteryVoltage<br />
                - 'environment.depth.belowTransducer' AS depth<br />
                - 'electrical.solar.Main.panelVoltage AS solarVoltage<br />
                - 'electrical.solar.Main.panelPower AS solarPower<br />
                - 'tanks.fuel.0.currentLevel' AS tankLevel<br />
                Check the
                <router-link class="va-text-bold va-link link" :to="{ name: 'explore' }">explore page</router-link> to
                see your signalk path.<br />
                For reference,
                <a
                  href="https://signalk.org/specification/1.7.0/doc/vesselsBranch.html"
                  target="_blank"
                  class="va-text-bold va-link link"
                  >https://signalk.org/specification/1.7.0/doc/vesselsBranch.html<va-icon
                    name="fa-external-link"
                    size="small" /></a
                ><br />
                You can setup the monitoring path you want to see in the
                <router-link class="va-text-bold va-link link" :to="{ name: 'boat-profile' }"
                  >boat correlation page</router-link
                >.
              </p>
            </div>
          </va-collapse>
          <va-collapse header="Windy Personal Weather Station (PWS)">
            <div class="pa-3">
              <p>
                Using your settings page, you can enable your profile to be public. Once you enable it, you will see an
                option to publish your observations as a weather station on Windy.com.<br />
                <br />
                You must have the following SignalK path:<br />
                - 'environment.outside.temperature'<br />
                - 'environment.wind.speedOverGround'<br />
                - 'environment.wind.directionTrue'<br />
                - 'environment.outside.relativeHumidity'<br />
                - 'environment.outside.pressure'<br />
                <br />
                You must configure monitoring data source for wind direction as `environment.wind.directionTrue` on your
                monitoring device. This is necessary because reporting apparent wind directions to Windy will be very
                confusing for those who are processing it! Data for `environment.wind.directionTrue` will likely be
                unavailable in your NMEA network, which is expected. You can use the awesome derived-data plugin to
                easily calculate it. You need to have outdoor temperature coming through
                environment.outside.temperature. This is required as Windy doesn't accept observations that don't
                include temperature readings. The more marine weather observations we have, the better forecasts we will
                collectively have! Thank you for your turning boat into a live weather station!
                <br />
                It can take up to one hour for your station to be create and accessible in Windy. You will received a
                notification when it is ready.
                <br />
                Check the
                <router-link class="va-text-bold va-link link" :to="{ name: 'explore' }">explore page</router-link> to
                see your signalk path.<br />
                For reference:
                <br />
                -
                <a
                  href="https://signalk.org/specification/1.7.0/doc/vesselsBranch.html"
                  target="_blank"
                  class="va-text-bold va-link link"
                  >SignalK vessels specification<va-icon name="fa-external-link" size="small" /></a
                ><br />
                -
                <a
                  href="https://community.windy.com/topic/8168/report-your-weather-station-data-to-windy"
                  target="_blank"
                  class="va-text-bold va-link link"
                  >Report your Weather Station Data to Windy<va-icon name="fa-external-link" size="small"
                /></a>
              </p>
            </div>
          </va-collapse>
          <va-collapse header="URLs">
            <div class="pa-3">
              - Web Application:
              <a href="https://iot.openplotter.cloud/" target="_blank" class="va-text-bold va-link link"
                >https://iot.openplotter.cloud/ <va-icon name="fa-external-link" size="small" /></a
              ><br />
              - API:
              <a href="https://api.openplotter.cloud/" target="_blank" class="va-text-bold va-link link"
                >https://api.openplotter.cloud/ <va-icon name="fa-external-link" size="small" /></a
              ><br />
              - Grafana:
              <a href="https://app.openplotter.cloud/" target="_blank" class="va-text-bold va-link link"
                >https://app.openplotter.cloud/ <va-icon name="fa-external-link" size="small" /></a
              ><br />
              - Telegram Bot:
              <a href="https://t.me/pgsail_bot" target="_blank" class="va-text-bold va-link link"
                >https://t.me/pgsail_bot <va-icon name="fa-external-link" size="small" /></a
              ><br />
            </div>
          </va-collapse>
          <va-collapse header="Source Code">
            <div class="pa-3">
              <p>
                The project is free and open-source and I welcome any contribution and happy to work together.
                Definitely, there are some bugs and room for improvements. The movement detection from the
                signalk-plugin is done via the auto-state plugin. as much as possible, I try to keep the technology
                stack simple, SQL and Javascript with a bit of python. No middle ware to reduce code maintenance.
              </p>
              <p>
                Source:<br />
                - PostgSail Signalk plugin:
                <a
                  href="https://github.com/xbgmsharp/signalk-postgsail"
                  target="_blank"
                  class="va-text-bold va-link link"
                  >https://github.com/xbgmsharp/signalk-postgsail<va-icon name="fa-external-link" size="small" /></a
                ><br />
                - PostgSail backend:
                <a href="https://github.com/xbgmsharp/postgsail" target="_blank" class="va-text-bold va-link link"
                  >https://github.com/xbgmsharp/postgsail<va-icon name="fa-external-link" size="small" /></a
                ><br />
                - PostgSail frontend:
                <a
                  href="https://github.com/xbgmsharp/vuestic-postgsail"
                  target="_blank"
                  class="va-text-bold va-link link"
                  >https://github.com/xbgmsharp/vuestic-postgsail<va-icon name="fa-external-link" size="small" /></a
                ><br />
                - PostgSail Telegram:
                <a
                  href="https://github.com/xbgmsharp/postgsail-telegram-bot"
                  target="_blank"
                  class="va-text-bold va-link link"
                  >https://github.com/xbgmsharp/postgsail-telegram-bot<va-icon
                    name="fa-external-link"
                    size="small" /></a
                ><br />
              </p>
            </div>
          </va-collapse>
          <va-collapse header="Contact">
            <div class="pa-3">
              You can send me an email or create a GitHub issue or join us on Discord.<br />
              -
              <a href="https://github.com/xbgmsharp/postgsail/issues" target="_blank" class="va-text-bold va-link link"
                >GitHub issue<va-icon name="fa-external-link" size="small" /></a
              ><br />
              -
              <a href="https://discord.gg/uuZrwz4dCS" target="_blank" class="va-text-bold va-link link"
                >Discord<va-icon name="fa-external-link" size="small" /></a
              ><br />
            </div>
          </va-collapse>
          <va-collapse header="Sponsor">
            <div class="pa-3">
              Help us maintain and improve this project! Your support makes a huge difference and keeps our project
              growing.<br />
              Support us directly through
              <a href="https://github.com/sponsors/xbgmsharp" target="_blank" class="va-text-bold va-link link"
                >GitHub Sponsors<va-icon name="fa-external-link" size="small"
              /></a>
              with monthly or one-time donations.<br />
              <h4>Every Contribution Matters</h4>
              <p>Join our growing community of supporters and help us make this project even better!</p>
            </div>
          </va-collapse>
          <va-collapse header="Where is my data stored?">
            <div class="pa-3">
              PostgSail is hosted in a European sovereign cloud and is fully compliant with GDPR and is not impacted by
              U.S. CLOUD Act law.<br />
              You own your data! You can request to delete your data at any time. You can also export your data.<br />
              <p>Join our growing community of supporters and help us make this project even better!</p>
            </div>
          </va-collapse>
        </va-accordion>
      </va-card-content>
    </va-card>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  const { t } = useI18n()
  const searchValue = ref('')
</script>

<style lang="scss"></style>
