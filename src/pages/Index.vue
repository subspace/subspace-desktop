<template lang="pug">
q-page(padding)
  .q-ma-xl
    .row.no-wrap.items-center.q-ma-xl.q-pt-lg
      .text-h1.q-pr-lg 👩‍🌾
      .column
        .text-h5.q-pb-md {{ $t('index.pageTitle') }}
        p {{ $t('index.subtitle') }}
  .row.justify-center.q-mt-xl
    q-btn(
      :label="$t('index.quickStart')"
      @click="viewDisclaimer('setupPlot')"
      outline
      size="md"
      no-caps
    )
  .row.justify-center.q-pt-md.q-pb-sm
    p — or —
  .row.justify-center
    q-btn(
      :label="$t('index.advanced')"
      @click="viewDisclaimer('importKey')"
      color="grey"
      flat
      no-caps
    )
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { Notify } from "quasar"
import * as util from "../lib/util"
import { appConfig } from "../lib/appConfig"
import disclaimer from "../components/disclaimer.vue"
import { useStore } from '../stores/store';

// TODO: consider removing appConfig from component and call store methods instead
export default defineComponent({
  setup() {
    const store = useStore();
    return { store };
  },
  async mounted() {
    try {
      this.checkDev()
      if (await appConfig.validate()) {
        util.infoLogger("INDEX | NOT First Time RUN.")
        await this.store.updateFromConfig();
        this.dashboard();
        return
      }
      util.infoLogger("validate failed, we should start from scratch")
      this.firstLoad()
    } catch (e) {
      util.infoLogger("config could not be read, starting from scratch")
      this.firstLoad()
    }
  },
  methods: {
    checkDev() {
      if (util.CONTEXT_MENU === "OFF")
        document.addEventListener("contextmenu", (event) =>
          event.preventDefault()
        )
    },
    dashboard() {
      this.$router.replace({ name: "dashboard" })
    },
    async firstLoad() {
      util.infoLogger("INDEX | First Time RUN, resetting reward address")
      await appConfig.update({ rewardAddress: "" })
      const config = await appConfig.read()
      if (config.launchOnBoot) {
        Notify.create({
          message: "Subspace Desktop will be started on boot. You can disable this from settings (the gear icon on top-right).",
          icon: "info"
        })
      }
    },
    async viewDisclaimer(destination: string) {
      const modal = await util.showModal(disclaimer)
      modal?.onDismiss(() => {
        this.$router.replace({ name: destination })
      })
    }
  }
})
</script>
