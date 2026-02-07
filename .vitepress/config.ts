import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'AstraFaber',
  description: '基于 Apache Arrow 的高性能数据库，面向 IoT 与边缘计算',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'AstraFaber' }],
    ['meta', { name: 'og:description', content: '基于 Apache Arrow 的高性能数据库' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'AstraFaber',

    nav: [
      { text: '首页', link: '/' },
      {
        text: 'SDK',
        items: [
          { text: 'Client SDK', link: '/sdk/client' },
          { text: 'Twin SDK', link: '/sdk/twin' },
        ],
      },
    ],

    sidebar: {
      '/sdk/': [
        {
          text: 'SDK 文档',
          items: [
            { text: 'Client SDK', link: '/sdk/client' },
            { text: 'Twin SDK', link: '/sdk/twin' },
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
      message: '基于 Apache Arrow 构建',
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
