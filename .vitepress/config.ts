import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'AstraFaber',
  description: '面向 IoT 与机器人的统一平台，集成设备建模、数据管理、文件服务与数字孪生',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'AstraFaber' }],
    ['meta', { name: 'og:description', content: '面向 IoT 与机器人的统一平台' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'AstraFaber',

    nav: [
      { text: '首页', link: '/' },
      {
        text: 'SDK',
        items: [
          { text: '总览', link: '/sdk/' },
          {
            text: 'Vera 模块',
            items: [
              { text: 'Client 数据读写', link: '/sdk/vera/client' },
              { text: 'Things 设备孪生', link: '/sdk/vera/things' },
            ],
          },
          {
            text: 'Arca 模块',
            items: [
              { text: 'File 文件上传', link: '/sdk/arca/file' },
              { text: 'Recorder MCAP 录制', link: '/sdk/arca/recorder' },
            ],
          },
        ],
      },
    ],

    sidebar: {
      '/sdk/': [
        {
          text: 'astra-faber SDK',
          items: [
            { text: '总览', link: '/sdk/' },
          ],
        },
        {
          text: 'Vera 模块',
          collapsed: false,
          items: [
            { text: 'Client 数据读写', link: '/sdk/vera/client' },
            { text: 'Things 设备孪生', link: '/sdk/vera/things' },
          ],
        },
        {
          text: 'Arca 模块',
          collapsed: false,
          items: [
            { text: 'File 文件上传', link: '/sdk/arca/file' },
            { text: 'Recorder MCAP 录制', link: '/sdk/arca/recorder' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/AstraFaber/astra-faber' },
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    footer: {
      message: 'IoT & Robotics Platform',
      copyright: 'Copyright © 2024-present AstraFaber',
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    outline: {
      label: '页面导航',
      level: [2, 3],
    },

    lastUpdated: {
      text: '最后更新于',
    },
  },
})
