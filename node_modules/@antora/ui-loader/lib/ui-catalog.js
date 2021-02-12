'use strict'

const $files = Symbol('files')

class UiCatalog {
  constructor () {
    this[$files] = new Map()
  }

  getFiles () {
    return [...this[$files].values()]
  }

  addFile (file) {
    const key = generateKey(file)
    if (this[$files].has(key)) {
      throw new Error('Duplicate file')
    }
    this[$files].set(key, file)
  }

  findByType (type) {
    const accum = []
    for (const candidate of this[$files].values()) {
      if (candidate.type === type) accum.push(candidate)
    }
    return accum
  }
}

/**
 * @deprecated superceded by getFiles(); scheduled to be removed in Antora 4
 */
UiCatalog.prototype.getAll = UiCatalog.prototype.getFiles

function generateKey ({ type, path }) {
  return type + '$' + path
}

module.exports = UiCatalog
