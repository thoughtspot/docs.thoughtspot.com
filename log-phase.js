'use strict'

module.exports.register = function () {
  if (global.reported) return
  console.log('load first AsciiDoc')
  global.reported = true
}
