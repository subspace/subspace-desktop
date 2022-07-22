<template lang="pug">
q-page.q-pa-lg.q-mr-lg.q-ml-lg
  .row.justify-center.q-mb-md
    .text-h4 {{ $t('plottingProgress.pageTitle') }}
  .row.justify-center
    p {{ $t('plottingProgress.infoDialog') }}
  .row.justify-center.q-mr-lg.q-ml-lg
    .col
      .row
        .col.q-mt-sm
          div {{ $t('plottingProgress.plotsDirectory') }}
          q-input(
            dense
            input-class="plottingInput"
            outlined
            readonly
            v-model="store.plotDir"
          )
      .row.items-center.q-gutter-md
        .col.relative-position
          q-linear-progress.rounded-borders(
            :value="progresspct / 100"
            rounded
            style="height: 40px"
            track-color="blue-2"
          )
            .absolute-full.flex.flex-center
              q-badge(color="white" size="lg" text-color="black")
                template(v-slot:default)
                  .q-pa-xs(style="font-size: 18px" v-if="progresspct > 0") {{ progresspct }}%
                  .q-pa-xs(style="font-size: 14px") {{ $t(store.plottingStatus.string, store.plottingStatus.values) }}
          q-linear-progress.absolute-right(
            :value="0.9"
            indeterminate
            style="height: 1px; top: 39px"
            track-color="transparent"
            v-if="store.status !== 'farming'"
          )
      .row.justify-center.q-gutter-md.q-pt-md
        .col-1
        .col-3.relative-position
          q-icon.absolute(
            color="blue-1"
            name="downloading"
            size="180px"
            style="z-index: -100; right: 100px"
          )
          .q-mt-sm {{ $t('plottingProgress.plotted') }}
          q-input.bg-white(
            dense
            input-class="plottingInput"
            outlined
            readonly
            suffix="GB"
            v-model="store.plottingFinished"
          )
          .q-mt-sm {{ $t('plottingProgress.remaining') }}
          q-input.bg-white(
            dense
            input-class="plottingInput"
            outlined
            readonly
            suffix="GB"
            v-model="store.plottingRemaining"
          )
        .col-2
        .col-3.relative-position
          q-icon.absolute(
            color="blue-1"
            name="schedule"
            size="180px"
            style="z-index: -100; right: 100px"
          )
          .q-mt-sm {{ $t('plottingProgress.elapsedTime') }}
          q-input.bg-white(
            dense
            input-class="plottingInput"
            outlined
            readonly
            v-model="printElapsedTime"
          )
          .q-mt-sm {{ $t('plottingProgress.remainingTime') }}
          q-input.bg-white(
            dense
            input-class="plottingInput"
            outlined
            readonly
            v-model="printRemainingTime"
          )

  .row.justify-end.q-mt-lg.absolute-bottom.q-pb-lg
    .col-auto.q-ml-xl.q-pr-md
      div {{ $t('plottingProgress.hint') }}
    .col.q-pr-md
      div {{ $t('plottingProgress.hintInfo') }}
    .col-auto.q-pr-md
    .col-expand
    .col-auto
      q-btn(
        :label="$t('plottingProgress.hints')"
        @click="viewIntro()"
        color="blue-8"
        icon-right="info"
        outline
        size="lg"
      )
    .col-auto
      q-btn(
        :label="$t('plottingProgress.next')"
        @click="$router.replace({ name: 'dashboard' })"
        color="blue-8"
        icon-right="play_arrow"
        outline
        size="lg"
        :disable="store.status !== 'farming'"
      )
      q-tooltip.q-pa-md(v-if="store.status !== 'farming'")
        p.q-mb-lg {{ $t('plottingProgress.waitPlotting') }}
</template>

<script lang="ts">
import { defineComponent } from "vue"
import * as util from "../lib/util"
import introModal from "../components/introModal.vue"
import { useStore } from '../stores/store';

let farmerTimer: number

export default defineComponent({
  setup() {
    const store = useStore();
    return { store };
  },
  data() {
    return {
      elapsedms: 0,
      remainingms: 0,
    }
  },
  computed: {
    progresspct(): number {
      const progress = parseFloat(
        ((this.store.syncState.currentBlock * 100) / this.store.syncState.highestBlock).toFixed(2)
      )
      return isNaN(progress) ? 0 : progress <= 100 ? progress : 100
    },
    printRemainingTime(): string {
      const val =
        this.store.status === 'farming' || this.elapsedms === 0
          ? util.formatMS(0)
          : util.formatMS(this.remainingms)
      return val
    },
    printElapsedTime(): string {
      return util.formatMS(this.elapsedms)
    }
  },
  async mounted() {
    util.infoLogger("PLOTTING PROGRESS | getting plot config")
    // TODO: probably can combine these two:
    this.store.setFirstLoad()
    this.store.setPlottingRemaining(this.store.plotSizeGB);
    util.infoLogger("PLOTTING PROGRESS | starting node")
    await this.store.startNode(this.$client);
    this.startTimers()
    util.infoLogger("PLOTTING PROGRESS | starting plotting")
    await this.startFarmer();
  },
  unmounted() {
    if (farmerTimer) clearInterval(farmerTimer)
  },
  methods: {
    async startFarmer(): Promise<void> {
      await this.store.startFarmer(this.$client);
      clearInterval(farmerTimer)
    },
    startTimers() {
      farmerTimer = window.setInterval(() => {
        this.elapsedms += 1000;
        const ms = (this.elapsedms * this.store.syncState.highestBlock) / (this.store.syncState.currentBlock || 1) - this.elapsedms;
        this.remainingms = util.toFixed(ms, 2);
      }, 1000)
    },
    async viewIntro() {
      await util.showModal(introModal)
    }
  }
})
</script>

<style lang="sass">
.plottingInput
  font-size: 20px
  padding-top: 5px
  margin-top: 0px
</style>
