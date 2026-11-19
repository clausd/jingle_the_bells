// Public-domain carols, one note per wall bounce. Each line is
// "syllable:note syllable:note …" so the lyric can be shown as it's played.
// Mary's Boy Child (1956) is still under copyright, so it isn't here.

export interface Note {
  syllable: string
  freq: number
}

export interface Song {
  title: string
  lines: Note[][]
}

const SEMI: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }

function freq(name: string) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name)
  if (!m) throw new Error(`bad note ${name}`)
  const semis = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12
  return 440 * 2 ** (semis / 12)
}

const line = (s: string): Note[] =>
  s.trim().split(/\s+/).map((tok) => {
    const [syllable, note] = tok.split(':')
    return { syllable: syllable.replace(/_/g, ' '), freq: freq(note) }
  })

const song = (title: string, ...lines: string[]): Song => ({ title, lines: lines.map(line) })

// Written at singing pitch; the bells play everything an octave higher.
const JINGLE_CHORUS_A = [
  'Jin-:B4 gle:B4 bells,:B4 jin-:B4 gle:B4 bells,:B4',
  'jin-:B4 gle:D5 all:G4 the:A4 way!:B4',
  'Oh,:C5 what:C5 fun:C5 it:C5 is:C5 to:B4 ride:B4',
  'in:B4 a:B4 one-:B4 horse:A4 o-:A4 pen:B4 sleigh,:A4 hey!:D5',
]
const JINGLE_CHORUS_B = [
  'Jin-:B4 gle:B4 bells,:B4 jin-:B4 gle:B4 bells,:B4',
  'jin-:B4 gle:D5 all:G4 the:A4 way!:B4',
  'Oh,:C5 what:C5 fun:C5 it:C5 is:C5 to:B4 ride:B4',
  'in:B4 a:B4 one-:D5 horse:D5 o-:C5 pen:A4 sleigh!:G4',
]

export const SONGS: Song[] = [
  song(
    'Jingle Bells',
    'Dash-:D4 ing:B4 through:A4 the:G4 snow,:D4',
    'in:D4 a:D4 one-:D4 horse:B4 o-:A4 pen:G4 sleigh,:E4',
    "o'er:E4 the:C5 fields:B4 we:A4 go,:F#4",
    'laugh-:D5 ing:D5 all:C5 the:A4 way.:B4',
    'Bells:D4 on:B4 bob-:A4 tail:G4 ring,:D4',
    'mak-:D4 ing:B4 spir-:A4 its:G4 bright,:E4',
    'what:E4 fun:E4 it:C5 is:B4 to:A4 ride:D5 and:D5 sing:D5 a:D5',
    'sleigh-:E5 ing:D5 song:C5 to-:A4 night!:G4',
    ...JINGLE_CHORUS_A,
    ...JINGLE_CHORUS_B,
  ),
  // In F, the usual key.
  song(
    'Deck the Halls',
    'Deck:C5 the:Bb4 halls:A4 with:G4 boughs:F4 of:G4 hol-:A4 ly,:F4',
    'fa:G4 la:A4 la:Bb4 la:G4 la,:A4 la:G4 la:F4 la:E4 la!:F4',
    "'Tis:C5 the:Bb4 sea-:A4 son:G4 to:F4 be:G4 jol-:A4 ly,:F4",
    'fa:G4 la:A4 la:Bb4 la:G4 la,:A4 la:G4 la:F4 la:E4 la!:F4',
    'Don:G4 we:A4 now:Bb4 our:G4 gay:A4 ap-:Bb4 par-:C5 el,:G4',
    'fa:A4 la:B4 la,:C5 la:D5 la:E5 la,:F5 la:E5 la:D5 la!:C5',
    'Troll:C5 the:Bb4 an-:A4 cient:G4 yule-:F4 tide:G4 car-:A4 ol,:F4',
    'fa:D5 la:D5 la:D5 la:D5 la,:C5 la:Bb4 la:A4 la:G4 la!:F4',
  ),
  song(
    'We Wish You a Merry Christmas',
    'We:D4 wish:G4 you:G4 a:A4 mer-:G4 ry:F#4 Christ-:E4 mas,:E4',
    'we:E4 wish:A4 you:A4 a:B4 mer-:A4 ry:G4 Christ-:F#4 mas,:D4',
    'we:F#4 wish:B4 you:B4 a:C5 mer-:B4 ry:A4 Christ-:G4 mas,:E4',
    'and:D4 a:D4 hap-:E4 py:A4 New:F#4 Year!:G4',
  ),
]

// Walks through the songs one note at a time, on to the next song at the end.
export class Songbook {
  song = 0
  line = 0
  note = 0

  get current() {
    return SONGS[this.song]
  }

  // The next note to play and where it is in its song; then advances.
  next() {
    const s = this.current
    const played = { ...s.lines[this.line][this.note], song: this.song, line: this.line, note: this.note }
    if (++this.note >= s.lines[this.line].length) {
      this.note = 0
      if (++this.line >= s.lines.length) this.nextSong()
    }
    return played
  }

  nextSong() {
    this.song = (this.song + 1) % SONGS.length
    this.line = this.note = 0
  }
}
