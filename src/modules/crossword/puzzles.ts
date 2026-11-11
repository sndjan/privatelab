// The crosswords, generated once from a list of personal words (marked
// "personal", only shown in the admin overview) filled up with classic
// crossword words. Each puzzle is opened by its secret link /k/<code>; the
// code is the only way in, so keep it unguessable. Umlauts are written out
// (Ä = AE, ß = SS), as in printed crosswords.
//
// grid: one string per row, "." for a block.

export type Direction = "across" | "down";

export type CrosswordWord = {
  n: number;
  dir: Direction;
  row: number;
  col: number;
  answer: string;
  clue: string;
  personal: boolean;
};

export type Crossword = {
  code: string;
  title: string;
  rows: number;
  cols: number;
  grid: string[];
  words: CrosswordWord[];
};

export const puzzles: Crossword[] = [
  {
    "code": "ymwu657eayas",
    "title": "Rätsel 1",
    "rows": 11,
    "cols": 10,
    "grid": [
      "....E..S.E",
      "KASACHSTAN",
      "I.E.H..U.G",
      "W.E.OBST.E",
      "I..A.O.TAL",
      ".VENEDIG..",
      "...K.E.A..",
      "...E.NARR.",
      ".OHR.S.T..",
      ".M...E....",
      "KAFFEE...."
    ],
    "words": [
      {
        "n": 4,
        "dir": "across",
        "row": 1,
        "col": 0,
        "answer": "KASACHSTAN",
        "clue": "Größtes Binnenland der Erde",
        "personal": true
      },
      {
        "n": 6,
        "dir": "across",
        "row": 3,
        "col": 4,
        "answer": "OBST",
        "clue": "Äpfel, Birnen und Co.",
        "personal": false
      },
      {
        "n": 9,
        "dir": "across",
        "row": 4,
        "col": 7,
        "answer": "TAL",
        "clue": "Senke zwischen Bergen",
        "personal": false
      },
      {
        "n": 10,
        "dir": "across",
        "row": 5,
        "col": 1,
        "answer": "VENEDIG",
        "clue": "Lagunenstadt mit Gondeln",
        "personal": true
      },
      {
        "n": 11,
        "dir": "across",
        "row": 7,
        "col": 5,
        "answer": "NARR",
        "clue": "Spaßmacher bei Hofe",
        "personal": false
      },
      {
        "n": 12,
        "dir": "across",
        "row": 8,
        "col": 1,
        "answer": "OHR",
        "clue": "Hörorgan",
        "personal": false
      },
      {
        "n": 13,
        "dir": "across",
        "row": 10,
        "col": 0,
        "answer": "KAFFEE",
        "clue": "Heißgetränk aus gerösteten Bohnen",
        "personal": true
      },
      {
        "n": 1,
        "dir": "down",
        "row": 0,
        "col": 4,
        "answer": "ECHO",
        "clue": "Widerhall",
        "personal": false
      },
      {
        "n": 2,
        "dir": "down",
        "row": 0,
        "col": 7,
        "answer": "STUTTGART",
        "clue": "Landeshauptstadt von Baden-Württemberg",
        "personal": true
      },
      {
        "n": 3,
        "dir": "down",
        "row": 0,
        "col": 9,
        "answer": "ENGEL",
        "clue": "Himmelsbote",
        "personal": false
      },
      {
        "n": 4,
        "dir": "down",
        "row": 1,
        "col": 0,
        "answer": "KIWI",
        "clue": "Grüne Frucht oder Laufvogel aus Neuseeland",
        "personal": true
      },
      {
        "n": 5,
        "dir": "down",
        "row": 1,
        "col": 2,
        "answer": "SEE",
        "clue": "Stehendes Gewässer",
        "personal": false
      },
      {
        "n": 7,
        "dir": "down",
        "row": 3,
        "col": 5,
        "answer": "BODENSEE",
        "clue": "Das „Schwäbische Meer“",
        "personal": true
      },
      {
        "n": 8,
        "dir": "down",
        "row": 4,
        "col": 3,
        "answer": "ANKER",
        "clue": "Hält das Schiff am Platz",
        "personal": false
      },
      {
        "n": 12,
        "dir": "down",
        "row": 8,
        "col": 1,
        "answer": "OMA",
        "clue": "Großmutter",
        "personal": false
      }
    ]
  },
  {
    "code": "p0xi7xoq3feo",
    "title": "Rätsel 2",
    "rows": 11,
    "cols": 10,
    "grid": [
      "...A.M....",
      "R..D.U.O.C",
      "ENTE.E.KUH",
      "H..RONJA.I",
      ".M...C.E.R",
      "LAUB.H.Y.U",
      ".D...E...R",
      "BELLENBERG",
      ".I..B.E...",
      ".R..BURG..",
      "RATTE.Q..."
    ],
    "words": [
      {
        "n": 6,
        "dir": "across",
        "row": 2,
        "col": 0,
        "answer": "ENTE",
        "clue": "Quakender Wasservogel",
        "personal": false
      },
      {
        "n": 7,
        "dir": "across",
        "row": 2,
        "col": 7,
        "answer": "KUH",
        "clue": "Milchlieferantin",
        "personal": false
      },
      {
        "n": 8,
        "dir": "across",
        "row": 3,
        "col": 3,
        "answer": "RONJA",
        "clue": "Räubertochter bei Astrid Lindgren",
        "personal": true
      },
      {
        "n": 10,
        "dir": "across",
        "row": 5,
        "col": 0,
        "answer": "LAUB",
        "clue": "Herbstblätter",
        "personal": false
      },
      {
        "n": 11,
        "dir": "across",
        "row": 7,
        "col": 0,
        "answer": "BELLENBERG",
        "clue": "Gemeinde an der Iller im Landkreis Neu-Ulm",
        "personal": true
      },
      {
        "n": 14,
        "dir": "across",
        "row": 9,
        "col": 4,
        "answer": "BURG",
        "clue": "Ritterbau",
        "personal": false
      },
      {
        "n": 15,
        "dir": "across",
        "row": 10,
        "col": 0,
        "answer": "RATTE",
        "clue": "Großes Nagetier",
        "personal": false
      },
      {
        "n": 1,
        "dir": "down",
        "row": 0,
        "col": 3,
        "answer": "ADER",
        "clue": "Blutgefäß",
        "personal": false
      },
      {
        "n": 2,
        "dir": "down",
        "row": 0,
        "col": 5,
        "answer": "MUENCHEN",
        "clue": "Bayerische Landeshauptstadt",
        "personal": true
      },
      {
        "n": 3,
        "dir": "down",
        "row": 1,
        "col": 0,
        "answer": "REH",
        "clue": "Scheues Waldtier",
        "personal": false
      },
      {
        "n": 4,
        "dir": "down",
        "row": 1,
        "col": 7,
        "answer": "OKAEY",
        "clue": "„Einverstanden!“",
        "personal": true
      },
      {
        "n": 5,
        "dir": "down",
        "row": 1,
        "col": 9,
        "answer": "CHIRURG",
        "clue": "Arzt, der operiert",
        "personal": true
      },
      {
        "n": 9,
        "dir": "down",
        "row": 4,
        "col": 1,
        "answer": "MADEIRA",
        "clue": "Portugiesische Blumeninsel im Atlantik",
        "personal": true
      },
      {
        "n": 12,
        "dir": "down",
        "row": 7,
        "col": 4,
        "answer": "EBBE",
        "clue": "Gegenteil von Flut",
        "personal": false
      },
      {
        "n": 13,
        "dir": "down",
        "row": 7,
        "col": 6,
        "answer": "BERQ",
        "clue": "Deutscher Sänger („Rote Flaggen“)",
        "personal": true
      }
    ]
  },
  {
    "code": "t38vljd9rojk",
    "title": "Rätsel 3",
    "rows": 11,
    "cols": 10,
    "grid": [
      ".HOF.EIS.T",
      ".A.E..L..A",
      ".I.SOELDEN",
      "...T..E..D",
      ".W....R..E",
      ".AMSTERDAM",
      ".L....I...",
      ".L.B.BEERE",
      "PADUA.D..S",
      ".C.N.GEIGE",
      ".HUT..N..L"
    ],
    "words": [
      {
        "n": 1,
        "dir": "across",
        "row": 0,
        "col": 1,
        "answer": "HOF",
        "clue": "Bauernanwesen",
        "personal": false
      },
      {
        "n": 3,
        "dir": "across",
        "row": 0,
        "col": 5,
        "answer": "EIS",
        "clue": "Gefrorenes Wasser",
        "personal": false
      },
      {
        "n": 6,
        "dir": "across",
        "row": 2,
        "col": 3,
        "answer": "SOELDEN",
        "clue": "Skiort im Ötztal",
        "personal": true
      },
      {
        "n": 8,
        "dir": "across",
        "row": 5,
        "col": 1,
        "answer": "AMSTERDAM",
        "clue": "Grachtenstadt in den Niederlanden",
        "personal": true
      },
      {
        "n": 10,
        "dir": "across",
        "row": 7,
        "col": 5,
        "answer": "BEERE",
        "clue": "Kleine Frucht vom Strauch",
        "personal": false
      },
      {
        "n": 12,
        "dir": "across",
        "row": 8,
        "col": 0,
        "answer": "PADUA",
        "clue": "Universitätsstadt westlich von Venedig",
        "personal": true
      },
      {
        "n": 13,
        "dir": "across",
        "row": 9,
        "col": 5,
        "answer": "GEIGE",
        "clue": "Streichinstrument",
        "personal": false
      },
      {
        "n": 14,
        "dir": "across",
        "row": 10,
        "col": 1,
        "answer": "HUT",
        "clue": "Kopfbedeckung",
        "personal": false
      },
      {
        "n": 1,
        "dir": "down",
        "row": 0,
        "col": 1,
        "answer": "HAI",
        "clue": "Raubfisch mit Rückenflosse",
        "personal": false
      },
      {
        "n": 2,
        "dir": "down",
        "row": 0,
        "col": 3,
        "answer": "FEST",
        "clue": "Feier",
        "personal": false
      },
      {
        "n": 4,
        "dir": "down",
        "row": 0,
        "col": 6,
        "answer": "ILLERRIEDEN",
        "clue": "Gemeinde an der Iller südlich von Ulm",
        "personal": true
      },
      {
        "n": 5,
        "dir": "down",
        "row": 0,
        "col": 9,
        "answer": "TANDEM",
        "clue": "Fahrrad für zwei",
        "personal": true
      },
      {
        "n": 7,
        "dir": "down",
        "row": 4,
        "col": 1,
        "answer": "WALLACH",
        "clue": "Kastriertes männliches Pferd",
        "personal": true
      },
      {
        "n": 9,
        "dir": "down",
        "row": 7,
        "col": 3,
        "answer": "BUNT",
        "clue": "Vielfarbig",
        "personal": true
      },
      {
        "n": 11,
        "dir": "down",
        "row": 7,
        "col": 9,
        "answer": "ESEL",
        "clue": "Grautier",
        "personal": false
      }
    ]
  },
  {
    "code": "dwrljkj1ua40",
    "title": "Rätsel 4",
    "rows": 11,
    "cols": 10,
    "grid": [
      ".......I.D",
      "R..FUCHS.A",
      "O.R..O.ARM",
      "TUEMMLER.E",
      "E.V..D....",
      "S.U.OPER..",
      "K.E..L.E.E",
      "R..KLAVIER",
      "E..A.Y.T.B",
      "U..I..REIS",
      "Z.RABE.N.E"
    ],
    "words": [
      {
        "n": 4,
        "dir": "across",
        "row": 1,
        "col": 3,
        "answer": "FUCHS",
        "clue": "Schlaues Raubtier mit buschigem Schwanz",
        "personal": false
      },
      {
        "n": 7,
        "dir": "across",
        "row": 2,
        "col": 7,
        "answer": "ARM",
        "clue": "Körperteil zwischen Schulter und Hand",
        "personal": false
      },
      {
        "n": 8,
        "dir": "across",
        "row": 3,
        "col": 0,
        "answer": "TUEMMLER",
        "clue": "Großer ___ (Delfinart)",
        "personal": true
      },
      {
        "n": 9,
        "dir": "across",
        "row": 5,
        "col": 4,
        "answer": "OPER",
        "clue": "Musiktheater",
        "personal": false
      },
      {
        "n": 12,
        "dir": "across",
        "row": 7,
        "col": 3,
        "answer": "KLAVIER",
        "clue": "Tasteninstrument mit 88 Tasten",
        "personal": true
      },
      {
        "n": 13,
        "dir": "across",
        "row": 9,
        "col": 6,
        "answer": "REIS",
        "clue": "Asiatisches Getreide",
        "personal": false
      },
      {
        "n": 14,
        "dir": "across",
        "row": 10,
        "col": 2,
        "answer": "RABE",
        "clue": "Schwarzer Vogel",
        "personal": false
      },
      {
        "n": 1,
        "dir": "down",
        "row": 0,
        "col": 7,
        "answer": "ISAR",
        "clue": "Fluss durch München",
        "personal": false
      },
      {
        "n": 2,
        "dir": "down",
        "row": 0,
        "col": 9,
        "answer": "DAME",
        "clue": "Wichtigste Schachfigur",
        "personal": false
      },
      {
        "n": 3,
        "dir": "down",
        "row": 1,
        "col": 0,
        "answer": "ROTESKREUZ",
        "clue": "Hilfsorganisation (2 Wörter)",
        "personal": true
      },
      {
        "n": 5,
        "dir": "down",
        "row": 1,
        "col": 5,
        "answer": "COLDPLAY",
        "clue": "Britische Band um Chris Martin",
        "personal": true
      },
      {
        "n": 6,
        "dir": "down",
        "row": 2,
        "col": 2,
        "answer": "REVUE",
        "clue": "Bühnenshow mit Tanz, Musik und Glamour",
        "personal": true
      },
      {
        "n": 10,
        "dir": "down",
        "row": 5,
        "col": 7,
        "answer": "REITEN",
        "clue": "Sich auf dem Pferderücken fortbewegen",
        "personal": true
      },
      {
        "n": 11,
        "dir": "down",
        "row": 6,
        "col": 9,
        "answer": "ERBSE",
        "clue": "Grünes Gemüse aus der Schote",
        "personal": false
      },
      {
        "n": 12,
        "dir": "down",
        "row": 7,
        "col": 3,
        "answer": "KAIA",
        "clue": "Model ___ Gerber, Tochter von Cindy Crawford",
        "personal": true
      }
    ]
  },
  {
    "code": "kidl6vpod2xj",
    "title": "Rätsel 5",
    "rows": 11,
    "cols": 10,
    "grid": [
      "...SUSHI..",
      "I.Z..T....",
      "GIULIA.O..",
      "E.G..RUDER",
      "L..W.N.E..",
      ".FREIBURG.",
      ".A.I.E....",
      ".RENNRAD.O",
      ".I...G.O.A",
      ".N....IRIS",
      "MAYA...F.E"
    ],
    "words": [
      {
        "n": 1,
        "dir": "across",
        "row": 0,
        "col": 3,
        "answer": "SUSHI",
        "clue": "Japanische Reishäppchen mit Fisch",
        "personal": true
      },
      {
        "n": 5,
        "dir": "across",
        "row": 2,
        "col": 0,
        "answer": "GIULIA",
        "clue": "Italienische Form von Julia",
        "personal": true
      },
      {
        "n": 7,
        "dir": "across",
        "row": 3,
        "col": 5,
        "answer": "RUDER",
        "clue": "Antrieb im Boot",
        "personal": false
      },
      {
        "n": 9,
        "dir": "across",
        "row": 5,
        "col": 1,
        "answer": "FREIBURG",
        "clue": "Stadt im Breisgau",
        "personal": true
      },
      {
        "n": 10,
        "dir": "across",
        "row": 7,
        "col": 1,
        "answer": "RENNRAD",
        "clue": "Schnelles Fahrrad mit gebogenem Lenker",
        "personal": true
      },
      {
        "n": 13,
        "dir": "across",
        "row": 9,
        "col": 6,
        "answer": "IRIS",
        "clue": "Farbiger Teil des Auges",
        "personal": false
      },
      {
        "n": 14,
        "dir": "across",
        "row": 10,
        "col": 0,
        "answer": "MAYA",
        "clue": "Alte Hochkultur in Mittelamerika",
        "personal": true
      },
      {
        "n": 2,
        "dir": "down",
        "row": 0,
        "col": 5,
        "answer": "STARNBERG",
        "clue": "Stadt am gleichnamigen See bei München",
        "personal": true
      },
      {
        "n": 3,
        "dir": "down",
        "row": 1,
        "col": 0,
        "answer": "IGEL",
        "clue": "Stacheltier",
        "personal": false
      },
      {
        "n": 4,
        "dir": "down",
        "row": 1,
        "col": 2,
        "answer": "ZUG",
        "clue": "Fährt auf Schienen",
        "personal": false
      },
      {
        "n": 6,
        "dir": "down",
        "row": 2,
        "col": 7,
        "answer": "ODER",
        "clue": "Grenzfluss zu Polen",
        "personal": false
      },
      {
        "n": 8,
        "dir": "down",
        "row": 4,
        "col": 3,
        "answer": "WEIN",
        "clue": "Rebensaft",
        "personal": false
      },
      {
        "n": 9,
        "dir": "down",
        "row": 5,
        "col": 1,
        "answer": "FARINA",
        "clue": "Johann Maria ___, Erfinder des Kölnisch Wassers",
        "personal": true
      },
      {
        "n": 11,
        "dir": "down",
        "row": 7,
        "col": 7,
        "answer": "DORF",
        "clue": "Kleine Gemeinde",
        "personal": false
      },
      {
        "n": 12,
        "dir": "down",
        "row": 7,
        "col": 9,
        "answer": "OASE",
        "clue": "Wasserstelle in der Wüste",
        "personal": false
      }
    ]
  }
];

export function getPuzzle(code: string) {
  return puzzles.find((puzzle) => puzzle.code === code);
}

// What the solver's browser gets: no hint which words are personal.
export type PublicCrossword = Omit<Crossword, "words"> & { words: Omit<CrosswordWord, "personal">[] };

export function toPublic(puzzle: Crossword): PublicCrossword {
  return {
    ...puzzle,
    words: puzzle.words.map((word) => ({ n: word.n, dir: word.dir, row: word.row, col: word.col, answer: word.answer, clue: word.clue })),
  };
}
