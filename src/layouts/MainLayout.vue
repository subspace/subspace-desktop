<template lang="pug">
q-layout(view="hHh lpr fFf")
  q-header.bg-white.text-black(bordered)
    q-toolbar.app-toolbar
      q-img(no-spinner src="subspacelogo.png" width="150px")
      q-toolbar-title
        .row.items-center
          .col-auto.q-mr-lg.relative-position
            p {{ appVersion }}
          .col-auto.q-mr-md.relative-position
            q-badge(color="grey" text-color="white")
              .q-pa-xs(style="font-size: 14px") {{ lang.IncentivizedLabel }}
            q-tooltip
              .col
                p.no-margin(style="font-size: 12px") {{ lang.IncentivizedTooltip }}
          .col-auto.q-mr-md.relative-position(v-if="global.nodeName || oldNodeName")
            q-badge.cursor-pointer(
              v-if="!isEdittingName"
              @click="onNameClick"
              color="blue-8"
              text-color="white"
            )
              .q-ma-xs(style="font-size: 14px") {{ "Node Name:" }}
              .q-mr-xs(
                class="text-italic"
                style="font-size: 14px"
              ) {{ trimmedName }}
            q-input.name-input(
              ref="nameInput"
              v-else
              v-model="global.nodeName"
              @blur="saveName"
              @keyup.enter="saveName"
              dense="dense"
              outlined
              autofocus
            )
          // Show the dashboard status indicator when on the dashboard page.
          .col-auto.q-mr-md.relative-position(
            v-if="$route.name == 'dashboard'"
          )
      div
        q-btn(flat icon="settings" round)
          MainMenu

  q-page-container
    router-view
</template>

<script lang="ts">
import { defineComponent } from "vue"
import * as process from 'process'
import * as util from "../lib/util"
import MainMenu from "../components/mainMenu.vue"
import { globalState as global } from "../lib/global"
import { appConfig } from "../lib/appConfig"

const lang = global.data.loc.text.mainMenu

export default defineComponent({
  name: "MainLayout",
  components: { MainMenu },
  data() {
    return {
      lang,
      global: global.data,
      appVersion: "",
      util,
      autoLaunch: false,
      isEdittingName: false,
      oldNodeName: "",
    }
  },
  computed: {
    trimmedName() {
      const { nodeName } = global.data;
      return nodeName.length > 20
        ? `${nodeName.slice(0, 20)}...`
        : nodeName;
    }
  },
  mounted() {
    this.appVersion = (process.env.APP_VERSION as string)
    util.infoLogger("Version: " + this.appVersion)

  },
  methods: {
    onNameClick() {
      this.setEditName(true);
      this.oldNodeName = global.data.nodeName;
    },
    async saveName() {
      // if user left input empty - use prev name
      if (!global.data.nodeName) {
        global.setNodeName(this.oldNodeName)
      } else {
        global.setNodeName(global.data.nodeName)
        await appConfig.update({ nodeName: global.data.nodeName })
        // TODO: consider restarting elsewhere
        console.log('Restarting...');
        const config = await appConfig.read();
        this.$client.startNode(config.plot.location, global.data.nodeName);
      }

      this.setEditName(false);
    },
    setEditName(value: boolean) {
      this.isEdittingName = value;
    }
  }
})
</script>
