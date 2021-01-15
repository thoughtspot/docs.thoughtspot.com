'use strict'
/* Copyright (c) 2018 OpenDevise, Inc.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Extends the AsciiDoc syntax to support a tabset. The tabset is created from
 * a dlist enclosed in an example block that is marked with the tabset style.
 *
 * Usage:
 *
 *  [tabset]
 *  ====
 *  Tab A::
 *  +
 *  --
 *  Contents of tab A.
 *  --
 *  Tab B::
 *  +
 *  --
 *  Contents of tab B.
 *  --
 *  ====
 *
 * @author Dan Allen <dan@opendevise.com>
 */

const Opal = global.Opal
const IdSeparatorCh = '-'
const ExtraIdSeparatorsRx = /^-+|-+$|-(-)+/g
const InvalidIdCharsRx = /[^a-zA-Z0-9_]/g

const generateId = (str, idx) =>
  `tabset${idx}_${str.toLowerCase().replace(InvalidIdCharsRx, IdSeparatorCh).replace(ExtraIdSeparatorsRx, '$1')}`

var toHash = function (object) {
  return object && !object.$$is_hash ? Opal.hash2(Object.keys(object), object) : object
}

function tabsetBlock () {
  this.named('tabset')
  this.onContext('example')
  this.process((parent, reader, attrs) => {
    const tabsetIdx = parent.getDocument().counter('idx-tabset')
    //find the dlist outside the current document, in an open block we'll discard.
    const container = this.parseContent(this.createBlock(parent, 'open'), reader)
    const sourceTabs = container.getBlocks()[0]
    if (!(sourceTabs && sourceTabs.getContext() === 'dlist' && sourceTabs.getItems().length)) return
    const outer = this.$create_open_block(parent, [], toHash(attrs))
    outer.addRole('tabset')
    outer.addRole('is-loading')
    outer['$id='](`tabset${tabsetIdx}`)
    const tabs = this.createList(parent, 'ulist')//List.$new(parent, 'ulist')
    tabs.addRole('tabs')
    const panes = {}
    sourceTabs.getItems().forEach(([[title], details]) => {
      const tab = this.createListItem(parent)//ListItem.$new(tabs)
      tab.addRole('tab') //Does not work unltil asciidoctor 2.
      tabs.blocks.push(tab)
      const id = generateId(title.getText(), tabsetIdx)
      tab.text = `[[${id}]]${title.text}`
      let blocks = details.getBlocks()
      const numBlocks = blocks.length
      if (numBlocks) {
        if (blocks[0].context === 'open' && numBlocks === 1) blocks = blocks[0].getBlocks()
        panes[id] = blocks.map((block) => (block.parent = parent) && block)
      }
    })
    outer.blocks.push(tabs)
    const panesBlock = this.$create_open_block(parent, [], toHash(attrs))
    panesBlock.addRole('tabset-panes')
    Object.entries(panes).forEach(([id, blocks]) => {
      const paneBlock = this.$create_open_block(parent, [], toHash(attrs))
      paneBlock['$id='](`${id}_pane`)
      paneBlock.addRole('tab-pane')
      paneBlock.blocks.push(...blocks)
      panesBlock.blocks.push(paneBlock)
    })
    outer.blocks.push(panesBlock)
    parent.blocks.push(outer)
  })
}

function openblockBlock () {
  const self = this
  self.named('openblock')
  self.onContext(['listing', 'paragraph'])
  self.positionalAttributes(['role'])
  self.process(function (parent, reader, attributes) {
    const result = self.$create_open_block(parent, [], toHash(attributes))
    delete attributes.role
    self.parseContent(result, reader, toHash(attributes))
    return result
  })
}

//not applicable to Antora but we'll want it soon
// function tabsetDocinfoProcessor () {
//   const self = this
//   self.atLocation('footer')//or 'header'?
//   self.process(function () {
//     //return String for header/footer content (?)
//   })
// }

// function register (registry) {
//   registry.block('tabset', tabsetBlock)
// }

module.exports.register = function (registry, config = {}) {
  function doRegister (registry) {
    // if (typeof registry.docinfoProcessor === 'function') {
    // registry.docinfoProcessor(tabsetDocinfoProcessor)
    // } else {
    //   console.warn('no \'docinfoProcessor\' method on alleged registry')
    // }
    if (typeof registry.block === 'function') {
      registry.block(tabsetBlock)
      registry.block(openblockBlock)
    } else {
      console.warn('no \'block\' method on alleged registry')
    }
  }

  if (typeof registry.register === 'function') {
    registry.register(function () {
      //Capture the global registry so processors can register more extensions.
      registry = this
      doRegister(registry)
    })
  } else {
    doRegister(registry)
  }
  return registry
}
