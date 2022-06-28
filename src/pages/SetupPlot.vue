<template lang="pug">
q-page.q-pa-lg.q-mr-lg.q-ml-lg
  .row.justify-center.q-mb-md
    .text-h4 {{ lang.pageTitle }}
  .row.justify-center
    p {{ lang.infoDialog }}
  .row.justify-center.q-mr-lg.q-ml-lg
    .col
      .row
        .col.q-mt-sm
          div {{ lang.plotsDirectory }}
          q-input.q-field--highlighted(
            :error="!validPath"
            :error-message="lang.invalidDir"
            color="blue"
            dense
            input-class="setupPlotInput"
            outlined
            v-model="plotDirectory"
          )
            template(v-slot:after)
              q-btn.shadow-0(
                @click="selectDir()"
                color="blue"
                flat
                icon="folder"
                size="lg"
              )
      .row.items-center.q-gutter-md
        .col-4
          .row
            .col.q-pr-md
              .q-mt-sm {{ lang.utilized }}
              q-input.bg-grey-3(
                dense
                input-class="setupPlotInput"
                outlined
                readonly
                suffix="GB"
                v-model="stats.utilizedGB"
              )
                q-tooltip.q-pa-sm
                  p {{ lang.utilizedSpace }}
              .q-mt-sm {{ lang.available }}
              q-input(
                :error="unsafeFree"
                dense
                hide-bottom-space
                input-class="setupPlotInput"
                outlined
                readonly
                suffix="GB"
                v-model="stats.freeGB"
              )
                q-tooltip.q-pa-sm
                  p {{ lang.availableSpace }}
              .q-mt-sm {{ lang.allocated }}
              // TODO: get error message from internationalization context
              // TODO: remove validation and restrict input to positive numbers when possible (Quasar component limitation)
              q-input(
                type="number"
                bg-color="blue-2"
                dense
                input-class="setupPlotInput"
                outlined
                suffix="GB"
                v-model.number="allocatedGB"
                :rules="[val => val > 0 || 'Value should be a positive number']"
              )
                q-tooltip.q-pa-sm
                  p {{ lang.allocatedSpace }}

        .col.q-pr-md
          .row.justify-center(
            style="transform: scale(-1, 1)"
          )
            apexchart(
              :options="chartOptions"
              :series="chartData"
              type="donut"
              width="200px"
            )
          .row.q-mt-md
            .col-1
            .col
              q-slider(
                :max="this.stats.safeAvailableGB"
                :min="1"
                :step="5"
                color="blue"
                snap
                style="height: 25px"
                v-model="allocatedGB"
              )
            .col-1
  .row.justify-end.q-mt-sm.absolute-bottom.q-pb-md
    .col-auto.q-pr-md
      div {{ lang.hint }}
    .col.q-pr-md
      div {{ lang.hint2 }}
    .col-expand
    .col-auto
      q-btn(
        :disable="(!validPath || allocatedGB <= 0)"
        @click="confirmCreateDir()"
        color="blue-8"
        icon-right="downloading"
        label="Start Plotting"
        outline
        size="lg"
      )
      q-tooltip.q-pa-md(v-if="!validPath")
        p.q-mb-lg {{ lang.tooltip }}
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { debounce } from "quasar"
import * as path from "@tauri-apps/api/path"
import * as fs from "@tauri-apps/api/fs"
import * as util from "../lib/util"
import { chartOptions, ChartDataType, StatsType } from "../lib/types"
import * as native from "../lib/native"
import { globalState as global } from "../lib/global"
import { appConfig } from "../lib/appConfig"
import { appData, appDataDialog } from "../lib/appData"
import mnemonicModal from "../components/mnemonicModal.vue"
import gpuModal from "../components/gpuModal.vue"

const tauri = { path, fs }
const lang = global.data.loc.text.setupPlot

export default defineComponent({
  data() {
    return {
      revealKey: false,
      plotDirectory: "/",
      allocatedGB: 1,
      validPath: true,
      defaultPath: "/",
      driveStats: <native.DriveStats>{ freeBytes: 0, totalBytes: 0 },
      lang,
      chartOptions,
      rewardAddress: ""
    }
  },
  computed: {
    chartData(): ChartDataType {
      return [
        this.stats.utilizedGB,
        this.stats.freeGB,
        this.allocatedGB,
      ]
    },
    stats(): StatsType {
      const totalDiskSizeGB = util.toFixed(this.driveStats.totalBytes / 1e9, 2)
      // node will occupy AT MOST 10GB (safe margin), so deduct 10GB from safe space
      const safeAvailableGB = this.driveStats.freeBytes / 1e9 - 10
      const utilizedGB = util.toFixed(totalDiskSizeGB - safeAvailableGB, 2)
      const freeGB = ((): number => {
        const val = util.toFixed(safeAvailableGB - this.allocatedGB, 2)
        if (val >= 0) {
          return val
        } else {
          return 0
        }
      })()

      return {
        totalDiskSizeGB,
        safeAvailableGB,
        utilizedGB,
        freeGB
      }
    },
    unsafeFree(): boolean {
      return this.stats.freeGB < 20
    }
  },
  watch: {
    "stats.freeGB"(val) {
      if (val < 0) {
        this.$nextTick(() => {
          this.stats.freeGB = 0
          console.log(this.stats.freeGB)
        })
      }
    },
    allocatedGB(val) {
      // input component currently allows negative numbers as value, so we need to check
      if (val >= 0) {
        if (!this.stats?.safeAvailableGB) return
        if (val > this.stats?.safeAvailableGB) {
          this.$nextTick(() => {
            this.allocatedGB = parseFloat(this.stats?.safeAvailableGB.toFixed(0))
          })
        } else {
          this.$nextTick(() => {
            this.allocatedGB = util.toFixed(this.allocatedGB, 2)
          })
        }
      } else {
        this.allocatedGB = 0;
      }
    }
  },
  async mounted() {
    await this.updateDriveStats()
    this.defaultPath = (await tauri.path.dataDir()) + util.appName
    this.plotDirectory = this.defaultPath
  },
  async created() {
    this.$watch(
      "plotDirectory",
      debounce((val): null => {
        if (val.length === 0) {
          this.validPath = false
        } else {
          if (this.plotDirectory == this.defaultPath) {
            this.validPath = true
          } else {
            // TODO: check if path is valid on any OS
            this.validPath = true
          }
        }
        return null
      }, 500)
    )
  },
  methods: {
    async confirmCreateDir() {
      const dirExists = await native.dirExists(this.plotDirectory)

      if (dirExists) {
        util.infoLogger("SETUP PLOT | found the old plotting directory")
        const files = await tauri.fs
          .readDir(this.plotDirectory)
          .catch((error) => {
            util.errorLogger(error)
          })

        if (files) {
          console.log("FILES ARE: :", files)
          if (files.length === 0 || (files.length === 1 && files.some(item => item.name === "subspace-desktop.cfg"))){
            appDataDialog.existingDirectoryConfirm(
              this.plotDirectory,
              this.prepareForPlotting
            )
          // we are in FIRST TIME START, meaning there is are no existing plot
          // if there are some files in this folder, it's weird
          } else {
            appDataDialog.notEmptyDirectoryInfo(this.plotDirectory)
          }
        }
      } else if (!dirExists) {
        appDataDialog.newDirectoryConfirm(
          this.plotDirectory,
          this.prepareForPlotting
        )
      }
    },
    async prepareForPlotting() {
      if (this.plotDirectory.charAt(this.plotDirectory.length - 1) == "/")
        this.plotDirectory.slice(-1)
      await appData.createCustomDataDir(this.plotDirectory)
      util.infoLogger("SETUP PLOT | custom directory created")
      await this.checkIdentity()
      const nodeName = util.generateNodeName()
      global.setNodeName(nodeName);

      await appConfig.update({
          plot: { location: this.plotDirectory, sizeGB: this.allocatedGB },
          nodeName,
        })

      await this.askGPU()
      this.$router.replace({ name: "plottingProgress" })
    },
    async updateDriveStats() {
      const stats = await native.driveStats(this.plotDirectory)
      util.infoLogger("Drive Stats -> free: " + stats.freeBytes + "; total: " + stats.totalBytes)
      this.driveStats = stats
    },
    async selectDir() {
      const result = await native
        .selectDir(this.plotDirectory)
        .catch((error: unknown) => {
          util.errorLogger(error)
        })
      if (result) this.plotDirectory = result
      await this.updateDriveStats()
    },
    async checkIdentity() {
      const config = await appConfig.read()
      if (config.rewardAddress === "") {
        util.infoLogger("SETUP PLOT | reward address was empty, creating a new one")
        this.rewardAddress = await this.$client.createRewardAddress()
        await this.viewMnemonic()
      }
      else {
        util.infoLogger("SETUP PLOT | reward address was initialized before, proceeding to plotting")
      }
    },
    async viewMnemonic(): Promise<void> {
      const modal = await util.showModal(mnemonicModal);
      return new Promise((resolve) => {
        modal?.onDismiss(async () => {
          await appConfig.update({
            rewardAddress: this.rewardAddress
          })
          resolve()
        })
      })
    },
    async askGPU(): Promise<void> {
      const modal = await util.showModal(gpuModal);
      return new Promise((resolve) => {
        modal?.onCancel(async () => {
          await appConfig.update({
            gpu: false
          })
          resolve()
        })
        modal?.onOk(async () => {
          await appConfig.update({
            gpu: true
          })
          resolve()
        })
      })
    }
  }
})
</script>

<style lang="sass">
.setupPlotInput
  font-size: 20px
  padding-top: 5px
  margin-top: 0px
</style>
