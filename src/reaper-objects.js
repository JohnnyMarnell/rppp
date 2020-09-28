const parser = require('./parser')
const fs = require('fs')
const ReaperBase = require('./reaper-base')
const ReaperAutomationTrack = require('./reaper-automation-track')
const path = require('path')
const { VstB64 } = require('./vst-utils')
const { base64StringByteLength } = require('./base64')

const emptys = fs.readFileSync(path.join(__dirname, '../data/empty.RPP'), 'utf8')

/**
 * @typedef {Object} ReaData
 * @property {string} token Reaper token such as VST, TRACK, or NAME
 * @property {Array} params ex. ["hi", 5000]
 * @property {ReaData[]} [contents] optional contents
 */
class ReaperProject extends ReaperBase {
  /**
   * @param {ReaData} obj
   */
  constructor (obj) {
    if (obj) super(obj)
    else {
      const empty = parser.parse(emptys)
      super(empty)
    }
  }

  /**
   * @param {ReaperTrack} obj
   */
  addTrack (trackObj) {
    if (!(trackObj instanceof ReaperTrack)) throw new TypeError('trackObj has to be of type ReaperTrack')
    return this.add(trackObj)
  }
}

class ReaperTrack extends ReaperBase {
  /**
   * @param {ReaData} obj
   */
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<TRACK
>`)
    }
    super(obj)
  }

  /**
   * @param {ReaperItem} obj
   */
  addItem (obj) {
    if (!(obj instanceof ReaperItem)) throw new TypeError('obj has to be of type ReaperItem')
    return this.add(obj)
  }
}

class ReaperItem extends ReaperBase {
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<ITEM
>`)
    }
    super(obj)
  }
}

class ReaperSource extends ReaperBase {
  /**
   * @param {ReaData} obj
   */
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<SOURCE WAVE
>`)
    }
    super(obj)
    if (this.isMidiSource()) this.cleanMidi()
  }

  isWaveSource () { return this.params[0] === 'WAVE' }
  isMidiSource () { return this.params[0] === 'MIDI' }

  makeWaveSource () {
    this.params[0] = 'WAVE'
    return this
  }

  makeMidiSource () {
    this.params[0] = 'MIDI'
    this.cleanMidi()
    return this
  }

  /**
   * Some numbers in the midi note should actually be strings and have to be cleaned.
   */
  cleanMidi () {
    if (!this.isMidiSource()) throw new Error('cleanMidi only works on MIDI sources')
    for (var i = 0; i < this.contents.length; i++) {
      if (['E', 'e', 'X', 'x', 'Em', 'em', 'Xm', 'xm'].indexOf(this.contents[i].token) >= 0) {
        for (var j = 1; j < 4; j++) {
          this.contents[i].params[j] = this.contents[i].params[j].toString() // Make the last three parameters be two character strings
          if (this.contents[i].params[j].length < 2) {
            this.contents[i].params[j] = '0' + this.contents[i].params[j]
          }
        }
      }
    }
    return this.contents
  }

  /**
   * Set this to a MIDI source. Replace the objects contents with midi notes.
   * @param {Object[]} notes Array of objects that look like this:
   *  { c: midiChannel (0-15), l: lengthWholeNotes, n: midiNoteNumber, s: startTimeWholeNotes, v: velocity (0-127) }
   */
  setMidiNotes (notes) {
    this.makeMidiSource()
    this.contents = ReaperSource.midiMessagesToContents(notes)
  }

  /**
   * Converts an array of MidiNotes into a rppp-style .contents array
   * https://wiki.cockos.com/wiki/index.php/StateChunkAndRppMidiFormat
   *
   * @param {MidiNote[]} midiArray
   * @param {Object} midiSettings
   *
   * Input is an array of objects that looks like this
   * ```
   * [
   *   { c: midiChannel (0-15), l: lengthWholeNotes, n: midiNoteNumber, s: startTimeWholeNotes, v: velocity (0-127) }
   * ]
   * ```
   * Output looks like this like this:
   * ```
   * [
   *   {token: 'HASDATA', params: [1, 960, 'QN']},
   *   {token: 'E', params: [0, 90, '3c', 60]},
   *   {token: 'E', params: [480, 80, '3c', 00]},
   *   {token: 'E', params: [0, 'b0', '7b', 00]},
   *   {token: 'X', params: [2^32 + 1, '90', '3c', 00]},
   *   {token: 'X', params: [2^32 + 1, '80', '3c', 00]},
   * ]
   * ```
   */
  static midiMessagesToContents (midiArray, midiSettings = { ticksQN: 960 }) {
    const conversion = 4
    const ticksWholeNotes = midiSettings.ticksQN * conversion

    const midiMessage = [{ token: 'HASDATA', params: [1, midiSettings.ticksQN, 'QN'] }]

    /**
     * Function for cleaning input and generating a Reaper midi message.
     */
    const note = (offset, channelAndStatus, midin, midiv) => {
      const res = []
      if (offset > Math.pow(2, 32) - 1) {
        res.push(offset - Math.pow(2, 32) - 1)
        res.push(Math.pow(2, 32) - 1)
      } else {
        res.push(offset)
      }
      res.push(channelAndStatus)
      res.push(midin)

      if (channelAndStatus[0] === '8') res.push('00')
      else res.push(midiv)

      return res
    }

    // Generate a 3D array to store start/stop times for each note on each channel.
    const midiData = [{ tick: 0 }]
    for (const note of midiArray) {
      if (!note.c) note.c = 0
      if (!note.v) note.v = 64
      const startTick = note.s * ticksWholeNotes
      const lengthTick = note.l * ticksWholeNotes

      midiData.push({ tick: startTick, status: '9', v: note.v, c: note.c, n: note.n })
      midiData.push({ tick: startTick + lengthTick, status: '8', v: note.v, c: note.c, n: note.n })
    }

    midiData.sort(function compare (a, b) {
      return a.tick - b.tick
    })

    // Loop through each start/stop command and generate its corresponding midi message.
    for (var i = 1; i < midiData.length; i++) {
      const channel = midiData[i].c.toString(16)
      if (channel.length > 1) throw new Error('midi channel has to be between 0 and 15')

      let midin = midiData[i].n.toString(16)
      if (midin.length < 2) midin = '0' + midin
      if (midin.length > 2) throw new Error('midi note has to be between 0 and 127')

      let midiv = midiData[i].v.toString(16)
      if (midiv.length < 2) midiv = '0' + midiv
      if (midiv.length > 2) throw new Error('midi velocity has to be between 0 and 127')

      let eventId = 'E'
      const offset = midiData[i].tick - midiData[i - 1].tick
      if (offset > Math.pow(2, 32) - 1) {
        eventId = 'X'
      }

      midiMessage.push({ token: eventId, params: note(offset, midiData[i].status + channel, midin, midiv) })
    }

    return midiMessage
  }
}

class ReaperFXChain extends ReaperBase {
  /**
   * @param {ReaData} obj
   */
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<FXCHAIN
  SHOW 0
  LASTSEL 0
  DOCKED 0
>`)
    }
    super(obj)

    // look for VST's external attributes
    const cleanedContents = []
    let i = 0
    for (; i < obj.contents.length; i++) {
      if (obj.contents[i].token === 'VST') {
        const VstObj = new ReaperVst(obj.contents[i])

        if (i !== 0 && obj.contents[i - 1].token === 'BYPASS') {
          VstObj.externalAttributes.BYPASS = obj.contents[i - 1].params
          cleanedContents.pop()
        }

        let toSkip = 0
        for (let j = 1; j < 5 && i + j < obj.contents.length; j++) {
          if (['BYPASS', 'PRESETNAME', 'FLOATPOS', 'FXID', 'WAK'].includes(obj.contents[i + j].token)) {
            VstObj.externalAttributes[obj.contents[i + j].token] = obj.contents[i + j].params
            toSkip += 1
          }
          if (obj.contents[i + j].token === 'VST' && j !== 0) {
            break
          }
        }

        cleanedContents.push(VstObj)
        i += toSkip
      } else {
        cleanedContents.push(obj.contents[i])
      }
    }

    obj.contents = cleanedContents
  }

  /**
   * @param {ReaperVst} obj
   */
  addVst (vstObj) {
    if (!(vstObj instanceof ReaperVst)) throw new TypeError('vstObj has to be of type ReaperVst')
    return this.add(vstObj)
  }
}

class ReaperVst extends ReaperBase {
  /**
   * @param {ReaData} obj
   */
  constructor (obj) {
    if (!obj) obj = parser.parse('<VST\n>')
    super(obj)
    while (this.params.length < 5) this.params.push('')
    this.externalAttributes = obj.externalAttributes || {}

    if (!this.b64Chunks[0]) this.b64Chunks[0] = new VstB64()
    if (!this.b64Chunks[1]) this.b64Chunks[1] = ''
    if (!this.b64Chunks[2]) this.b64Chunks[2] = 'AAAQAAAA' // 'No Preset'

    if (typeof this.b64Chunks[0] === 'string') {
      // .b64Chunks can contain objects that have a .toString() method
      this.b64Chunks[0] = VstB64.fromString(this.b64Chunks[0])
    }
  }

  dumpExternalAttribute (attr, indent) {
    if (typeof attr !== 'string') throw new TypeError('attr must be of type string')
    if (this.externalAttributes[attr]) {
      return ReaperBase.dumpStruct(attr, this.externalAttributes[attr], indent) + '\n'
    }
    return ''
  }

  dump (indent = 0) {
    // These attributes correspond to the VST object, not the FXChain object.
    const BYPASS = this.dumpExternalAttribute('BYPASS', indent)
    const PRESETNAME = this.dumpExternalAttribute('PRESETNAME', indent)
    const FLOATPOS = this.dumpExternalAttribute('FLOATPOS', indent)
    const FXID = this.dumpExternalAttribute('FXID', indent)
    const WAK = this.dumpExternalAttribute('WAK', indent)

    let misc = ''
    for (const o of this.contents) {
      if (o.contents) {
        misc += o.dump(indent) + '\n'
      } else {
        misc += ReaperBase.dumpStruct(o.token, o.params, indent + 1) + '\n'
      }
    }

    const indentStr = '  '.repeat(indent)
    const start = indentStr + '<' + this.token + ReaperBase.dumpParams(this.params) + '\n'
    const body = this.dumpB64Chunks(indent + 1)
    const end = indentStr + '>'
    const vstBody = start + body + end + '\n'

    return (BYPASS + vstBody + PRESETNAME + FLOATPOS + FXID + misc + WAK).slice(0, -1)
  }

  /**
   * @param {string} b64String the plugin's state in base64 format
   */
  setVst2State (b64String) {
    if (typeof b64String !== 'string') {
      throw new Error('ReaperVst.setVst2State did not receive a string')
    }
    this.b64Chunks[0].stateSize = base64StringByteLength(b64String)
    this.b64Chunks[1] = b64String
  }

  initializeRouting (numIn = 2, numOut = 2) {
    this.b64Chunks[0].numIn = numIn
    this.b64Chunks[0].numOut = numOut
  }

  setVst2IdNumber (idNumber) {
    this.b64Chunks[0].vst2IdNumber = idNumber
  }
}

class ReaperPluginAutomation extends ReaperAutomationTrack {
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<PARMENV
>`)
    }
    super(obj)
  }
}

class ReaperNotes extends ReaperBase {
  /**
   * @param {ReaData} obj
   */
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<NOTES
>`)
    }
    super(obj)
  }

  dump (indent = 0) {
    const notes = this.params[0].split('\n')
    var start = '  '.repeat(indent) + '<NOTES\n'
    var body = ''
    for (const line of notes) {
      body += '  '.repeat(indent + 1) + '|' + line + '\n'
    }
    var end = '  '.repeat(indent) + '>'
    return start + body + end
  }
}

class ReaperVolumeAutomation extends ReaperAutomationTrack {
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<VOLENV2
>`)
    }
    super(obj)
  }
}

class ReaperPanAutomation extends ReaperAutomationTrack {
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<PANENV2
>`)
    }
    super(obj)
  }
}

class ReaperWidthAutomation extends ReaperAutomationTrack {
  constructor (obj) {
    if (!obj) {
      obj = parser.parse(
`<WIDTHENV2
>`)
    }
    super(obj)
  }
}

/**
 * Serializes an object and outputs it as an RPP file.
 */
class Tests {
  /**
     * Parses an object and dumps its representation as a string in RPP format.
     * @param {object} obj - An object of the following format containing information in an RPP file.
     * {
     *  token {string}: NAME OF TOKEN
     *  params {Array}: Object parameters
     *  contents {Array}: Array of structs or objects
     * }
     */
  dump (input, debugSettings) {
    switch (debugSettings.startRule) {
      case 'int':
        return ReaperBase.dumpNum(input)
      case 'decimal':
        return ReaperBase.dumpNum(input)
      case 'params':
        return ReaperBase.dumpParams(input)
      case 'string':
        return ReaperBase.dumpString(input)
      case 'midi':
        return ReaperSource.midiMessagesToContents(input)
      default:
        return input.dump()
    }
  }
}

module.exports = {
  ReaperProject,
  ReaperItem,
  ReaperVst,
  ReaperTrack,
  ReaperSource,
  ReaperNotes,
  Tests,
  ReaperFXChain,
  ReaperPluginAutomation,
  ReaperPanAutomation,
  ReaperVolumeAutomation,
  ReaperWidthAutomation
}
