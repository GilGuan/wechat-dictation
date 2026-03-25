// pages/lesson-select/lesson-select.js
const wordDatabase = require('../../data/wordDatabase.js')

Page({
  data: {
    grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    gradeIndex: 0,
    subjects: ['语文', '英语'],
    subjectIndex: 0,
    semesters: ['上册', '下册'],
    semesterIndex: 0,

    lessons: [],
    selectedWords: [],
    totalWordCount: 0,

    showWarning: false,
    warningText: '',

    loading: false
  },

  onLoad() {
    this.loadLessons()
    this.restoreSelection()
  },

  // 恢复上次选择
  restoreSelection() {
    try {
      const lastSelection = wx.getStorageSync('last_selection')
      if (lastSelection) {
        this.setData({
          gradeIndex: lastSelection.gradeIndex || 0,
          subjectIndex: lastSelection.subjectIndex || 0,
          semesterIndex: lastSelection.semesterIndex || 0
        })
        this.loadLessons()
      }
    } catch (e) {
      console.error('恢复选择失败:', e)
    }
  },

  // 保存选择
  saveSelection() {
    try {
      wx.setStorageSync('last_selection', {
        gradeIndex: this.data.gradeIndex,
        subjectIndex: this.data.subjectIndex,
        semesterIndex: this.data.semesterIndex
      })
    } catch (e) {
      console.error('保存选择失败:', e)
    }
  },

  // 年级切换
  onGradeChange(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ gradeIndex: index })
    this.loadLessons()
    this.saveSelection()
  },

  // 科目切换
  onSubjectChange(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ subjectIndex: index })
    this.loadLessons()
    this.saveSelection()
  },

  // 册次切换
  onSemesterChange(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ semesterIndex: index })
    this.loadLessons()
    this.saveSelection()
  },

  // 加载课文列表
  loadLessons() {
    const subjectKey = this.data.subjectIndex === 0 ? 'chinese' : 'english'
    const gradeKey = `grade${this.data.gradeIndex + 1}`
    const semesterKey = this.data.semesterIndex === 0 ? 'upper' : 'lower'

    const subjectData = wordDatabase[subjectKey]
    if (!subjectData) {
      this.setData({
        lessons: [],
        selectedWords: [],
        totalWordCount: 0
      })
      return
    }

    const gradeData = subjectData[gradeKey]
    if (!gradeData) {
      this.setData({
        lessons: [],
        selectedWords: [],
        totalWordCount: 0
      })
      return
    }

    const semesterData = gradeData[semesterKey]
    if (!semesterData || !semesterData.lessons) {
      this.setData({
        lessons: [],
        selectedWords: [],
        totalWordCount: 0
      })
      return
    }

    // 添加 expanded 和 words 属性，每个 word 添加 selected 属性
    const lessons = semesterData.lessons.map(lesson => ({
      ...lesson,
      expanded: false,
      wordCount: lesson.words.length,
      selectedWordCount: 0,
      words: lesson.words.map(word => ({
        ...word,
        selected: false
      }))
    }))

    this.setData({
      lessons,
      selectedWords: [],
      totalWordCount: 0
    })
  },

  // 展开/折叠课文
  toggleLessonExpand(e) {
    const lessonId = e.currentTarget.dataset.id
    const lessons = this.data.lessons.map(lesson => {
      if (lesson.id === lessonId) {
        lesson.expanded = !lesson.expanded
      }
      return lesson
    })

    this.setData({ lessons })
  },

  // 全选/取消全选某个课文的所有词语
  toggleSelectAll(e) {
    const lessonId = e.currentTarget.dataset.id
    const lessons = this.data.lessons.map(lesson => {
      if (lesson.id === lessonId) {
        const allSelected = lesson.selectedWordCount === lesson.wordCount
        // 如果全部已选中，则取消全选；否则全选
        const newSelected = !allSelected
        lesson.words = lesson.words.map(word => ({
          ...word,
          selected: newSelected
        }))
        lesson.selectedWordCount = newSelected ? lesson.wordCount : 0
      }
      return lesson
    })

    // 收集所有选中的词语
    const selectedWords = []
    lessons.forEach(lesson => {
      lesson.words.forEach(word => {
        if (word.selected) {
          selectedWords.push({
            ...word,
            lessonId: lesson.id,
            lessonTitle: lesson.title
          })
        }
      })
    })

    const totalWordCount = selectedWords.length

    let showWarning = false
    let warningText = ''

    if (totalWordCount > 30) {
      showWarning = true
      warningText = '词数较多，建议分批'
    }

    this.setData({
      lessons,
      selectedWords,
      totalWordCount,
      showWarning,
      warningText
    })
  },

  // 切换词语选择
  toggleWord(e) {
    const lessonId = e.currentTarget.dataset.lessonId
    const wordIndex = e.currentTarget.dataset.wordIndex

    const lessons = this.data.lessons.map(lesson => {
      if (lesson.id === lessonId) {
        lesson.words[wordIndex].selected = !lesson.words[wordIndex].selected
        lesson.selectedWordCount = lesson.words.filter(w => w.selected).length
      }
      return lesson
    })

    // 收集所有选中的词语
    const selectedWords = []
    lessons.forEach(lesson => {
      lesson.words.forEach(word => {
        if (word.selected) {
          selectedWords.push({
            ...word,
            lessonId: lesson.id,
            lessonTitle: lesson.title
          })
        }
      })
    })

    const totalWordCount = selectedWords.length

    let showWarning = false
    let warningText = ''

    if (totalWordCount > 30) {
      showWarning = true
      warningText = '词数较多，建议分批'
    }

    this.setData({
      lessons,
      selectedWords,
      totalWordCount,
      showWarning,
      warningText
    })
  },

  // 开始听写
  startDictation() {
    if (this.data.selectedWords.length === 0) {
      wx.showToast({
        title: '请先选择词语',
        icon: 'none'
      })
      return
    }

    const totalWords = this.data.totalWordCount
    if (totalWords === 0) {
      wx.showToast({
        title: '请先选择词语',
        icon: 'none'
      })
      return
    }

    // 随机打乱顺序
    const shuffled = this.shuffleArray([...this.data.selectedWords])

    // 保存会话
    const app = getApp()
    app.saveSession({
      words: shuffled,
      currentIndex: 0,
      startTime: Date.now()
    })

    // 跳转到听写页面
    wx.navigateTo({
      url: '/pages/dictation/dictation'
    })
  },

  // Fisher-Yates 洗牌算法
  shuffleArray(array) {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
})