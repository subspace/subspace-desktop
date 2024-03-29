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
              .q-pa-xs(style="font-size: 14px") {{ $t('header.IncentivizedLabel') }}
            q-tooltip
              .col
                p.no-margin(style="font-size: 12px") {{ $t('header.IncentivizedTooltip') }}
          .col-auto.q-mr-md.relative-position(v-if="store.nodeName || oldNodeName")
            q-badge.cursor-pointer(
              v-if="!isEdittingName"
              @click="onNameClick"
              color="blue-8"
              text-color="white"
            )
              .q-ma-xs(style="font-size: 14px") {{ $t('header.nodeName') }}
              .q-mr-xs(
                class="text-italic"
                style="font-size: 14px"
              ) {{ store.trimmedName }}
            q-input.name-input(
              ref="nameInput"
              v-else
              v-model="store.nodeName"
              @blur="saveName"
              @keyup.enter="saveName"
              dense
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
import { defineComponent, watch } from 'vue';
import * as process from 'process';
import MainMenu from '../components/mainMenu.vue';
import { useStore } from '../stores/store';

export default defineComponent({
  name: 'MainLayout',
  components: { MainMenu },
  setup() {
    const store = useStore();
    return { store };
  },
  data() {
    return {
      appVersion: '',
      isEdittingName: false,
      oldNodeName: '',
    };
  },
  mounted() {
    this.appVersion = (process.env.APP_VERSION as string);
    this.$tauri.infoLogger('Version: ' + this.appVersion);

    // if there is an error - redirect to error page
    watch(
      () => this.store.error.title,
      () => this.$router.push({ name: 'errorPage' }),
    );
  },
  methods: {
    onNameClick() {
      this.setEditName(true);
      this.oldNodeName = this.store.nodeName;
    },
    async saveName() {
      this.setEditName(false);
      // if user left input empty - use prev name
      if (!this.store.nodeName) {
        await this.store.setNodeName(this.$config, this.oldNodeName);
      // only restart if name has changed
      } else if (this.oldNodeName !== this.store.nodeName) {
        await this.store.setNodeName(this.$config, this.store.nodeName);
        await this.store.startNode(this.$client, this.$tauri);
      }
    },
    setEditName(value: boolean) {
      this.isEdittingName = value;
    }
  }
});
</script>
