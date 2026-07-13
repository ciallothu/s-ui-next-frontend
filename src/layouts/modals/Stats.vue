<template>
  <v-dialog transition="dialog-bottom-transition" width="800">
    <v-card class="rounded-lg" :loading="loading">
      <v-card-title>
        <v-row>
          <v-col cols="auto">
            {{ $t('stats.graphTitle') }}
          </v-col>
          <v-spacer></v-spacer>
          <v-col cols="auto"><v-icon icon="mdi-close" @click="$emit('close')"></v-icon></v-col>
        </v-row>
      </v-card-title>
      <v-divider></v-divider>
      <v-card-text style="padding: 0 16px;">
        <div style="text-align: center; margin: 5px;">
          {{ $t('objects.' + resource) + " : " + tag }}
        </div>
        <v-radio-group v-model="limit" @change="changePeriod" density="compact" :loading="loading" inline hide-details>
          <v-radio v-for="p in periods" :key="p.value" :label="p.title" :value="p.value"></v-radio>
        </v-radio-group>
          <v-container id="container" style="height:40vh;">
            <v-skeleton-loader
            class="mx-auto border"
            width="95%"
            type="image"
            v-if="loading"
          ></v-skeleton-loader>
          <template v-else>
            <v-alert :text="$t('noData')" type="warning" variant="outlined" v-if="alert"></v-alert>
            <LineChart v-if="loaded" :data="usage" :options="<any>options" />
          </template>
        </v-container>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { i18n } from '@/locales'
import HttpUtils from '@/plugins/httputil'
import { HumanReadable } from '@/plugins/utils'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { ref } from 'vue'
import { Line as LineChart } from 'vue-chartjs'
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)
ChartJS.defaults.font.family = 'Vazirmatn'
export default {
  components: {
    LineChart
  },
  props: ['visible','resource','tag'],
  data() {
    return {
      loading: false,
      loaded: false,
      alert: false,
      intervalId: <any>0,
	  limit: <number | string>1,
      periods: [
		{ value: 'live', title: i18n.global.t('stats.live') },
        { value: 1, title: i18n.global.n(1) + i18n.global.t('date.h')},
        { value: 6, title: i18n.global.n(6) + i18n.global.t('date.h')},
        { value: 12, title: i18n.global.n(12) + i18n.global.t('date.h')},
        { value: 24, title: i18n.global.n(1) + i18n.global.t('date.d')},
        { value: 48, title: i18n.global.n(2) + i18n.global.t('date.d')},
        { value: 240, title: i18n.global.n(10) + i18n.global.t('date.d')},
        { value: 480, title: i18n.global.n(20) + i18n.global.t('date.d')},
        { value: 720, title: i18n.global.n(30) + i18n.global.t('date.d')},
        { value: 1440, title: i18n.global.n(60) + i18n.global.t('date.d')},
        { value: 2160, title: i18n.global.n(90) + i18n.global.t('date.d')},
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        elements: {
          line: {
            borderWidth: 2,
            tension: 0.15,
          },
          point: {
            pointStyle: 'circle',
            radius: 3,
            hoverRadius: 6,
            borderWidth: 1,
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              text: (ctx:any) => {
                const {axis = 'xy', intersect, mode} = ctx.chart.options.interaction
                return 'Mode: ' + mode + ', axis: ' + axis + ', intersect: ' + intersect
              },
              footer: (items:any[]) => {
                return HumanReadable.sizeFormat(items.reduce((acc, c) => acc + c.raw, 0))
              }
            }
          }
        },
        scales: {
          y: {
            grid: {
              color: '#777777',
            },
            beginAtZero: true,
            ticks: {
              callback: function(label:any) {
                return label == 0 ? 0 : HumanReadable.sizeFormat(label,0)
              },
              count: 10
            }
          }
        }
      },
      usage: ref(<any>{}),
    }
  },
  methods: {
    async loadData() {
      this.loading = true
	  const requestLimit = this.limit === 'live' ? 1 : Number(this.limit)
      const data = await HttpUtils.get('api/stats', { resource: this.resource, tag: this.tag, limit: requestLimit })
      if (data.success && data.obj) {
        const obj = <any[]>data.obj
		const l = this.dateLocale()
		const oneStep = requestLimit * 3600 * 1000 / 360
        const now = new Date().getTime()
        const steps = <number[]>[]
        for (let i = 360; i >= 0; i--) {
          steps.push(now - (oneStep * i))
        }
        const labels = <string[]>[]
        const uplinkData: Array<number | null> = []
        const downlinkData: Array<number | null> = []
        for (let i = 1; i<360; i++) {
          labels.push(this.genLable(steps[i],l))
          const upTraffics = obj.filter(o => o.direction && o.dateTime*1000 < steps[i] && o.dateTime*1000 > steps[i-1]).map((o:any) => o.traffic)
          const upSum = upTraffics.length > 0
            ? upTraffics.reduce((sum:number, value:number) => sum + value, 0)
            : null
          const downTraffics = obj.filter(o => !o.direction && o.dateTime*1000 < steps[i] && o.dateTime*1000 > steps[i-1]).map((o:any) => o.traffic)
          const downSum = downTraffics.length > 0
            ? downTraffics.reduce((sum:number, value:number) => sum + value, 0)
            : null
          uplinkData.push(upSum)
          downlinkData.push(downSum)
        }
        this.usage = {
          labels: labels,
          datasets: [
            {
              label: i18n.global.t('stats.upload'),
              backgroundColor: 'rgba(255, 165, 0, 0.4)',
              borderColor: 'rgba(255, 165, 0)',
              pointBackgroundColor: 'rgba(255, 165, 0)',
              fill: false,
              spanGaps: true,
              data: uplinkData
            },
            {
              label: i18n.global.t('stats.download'),
              backgroundColor: 'rgba(0, 128, 0, 0.2)',
              borderColor: 'rgba(0, 128, 0)',
              pointBackgroundColor: 'rgba(0, 128, 0)',
              fill: false,
              spanGaps: true,
              data: downlinkData
            }
          ],
        }
        this.loaded = true
        this.alert = false
      } else {
        this.alert = true
        this.loaded = false
      }
      this.loading = false
    },
	changePeriod() {
	  if (this.intervalId) {
		clearInterval(this.intervalId)
		this.intervalId = 0
	  }
	  this.loadData()
	  if (this.limit === 'live') {
		this.intervalId = setInterval(() => this.loadData(), 10000)
	  }
	},
    genLable(step:number, locale: string) {
      return new Date(step).toLocaleString(locale,{
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    },
    dateLocale() {
      const selected = String(i18n.global.locale.value)
      return ({ zhHans: 'zh-CN', zhHant: 'zh-TW', fa: 'fa-IR', vi: 'vi-VN', ru: 'ru-RU', ja: 'ja-JP', fr: 'fr-FR', la: 'la' } as Record<string, string>)[selected] ?? 'en-US'
    },
  },
  watch: {
    visible(v) {
      if (v) {
        this.limit = 1
        this.loadData()
      } else {
        this.loaded = false
        this.alert = false
        this.usage.labels = []
        if (this.usage.datasets) {
          this.usage.datasets[0].data = []
          this.usage.datasets[1].data = []
        }
        if (this.intervalId && this.intervalId != 0) {
          clearInterval(this.intervalId)
		  this.intervalId = 0
        }
      }
    }
  }
}
</script>
