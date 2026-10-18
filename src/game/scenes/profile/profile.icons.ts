import type { PixelIcon } from '../../utils/pixel_icon';

export const SHOW_ICON: PixelIcon = {
  rows: [
    '.....######.....',
    '...##wwwwww##...',
    '..#wwwbbbbwww#..',
    '.#wwwbBkkBbwww#.',
    '#wwwwbkhkkbwwww#',
    '#wwwwbkkkkbwwww#',
    '.#wwwbBkkBbwww#.',
    '..#wwwbbbbwww#..',
    '...##wwwwww##...',
    '.....######.....',
  ],
  palette: {
    '#': '#020203',
    w: '#e8edf2',
    b: '#4caf7a',
    B: '#2f7d52',
    k: '#020203',
    h: '#ffffff',
  },
  scale: 2,
};

export const RENAME_ICON: PixelIcon = {
  rows: [
    '............##..',
    '...........#pp#.',
    '..........#pppp#',
    '.........#mpppp#',
    '........#ymmpp#.',
    '.......#yyYmm#..',
    '......#yyYYY#...',
    '.....#yyYYY#....',
    '....#yyYYY#.....',
    '...#wyYYY#......',
    '...#wwwY#.......',
    '..#kwww#........',
    '..#kkw#.........',
    '..###...........',
  ],
  palette: {
    '#': '#020203',
    p: '#ee7fb4',
    m: '#8f99a6',
    y: '#f2c94c',
    Y: '#c99a2e',
    w: '#e8c39a',
    k: '#4a5361',
  },
  scale: 2,
};

export const RELEASE_ICON: PixelIcon = {
  rows: [
    '...#..................',
    '..#b####.....####.....',
    '..#bbbbb#...#bbbb#....',
    '...#bbbbb#.#bbbbbb#...',
    '..#bbbbbbb#bbbbbbbb#..',
    '...##bbbbb#bbbwwwwb#..',
    '...#bbbbbbbbbwww#ww#..',
    '....#bbbbbbbbwwwwwwk#.',
    '.....##bbwwwbbwwww##..',
    '########wwwwwwww##....',
    '#bbbbbbwwwwwwwwwb#....',
    '.#bbbbbwwwwwwwwbbb#...',
    '..#bbbbbwwwwwbbbbb#...',
    '.#bbbbb######bbbbbb##.',
    '..##bb#.....#bbbbbbbb#',
    '...#b#.......#b#bbb##.',
    '....#.........##b#bb#.',
    '................#.##..',
  ],
  palette: {
    '#': '#020203',
    b: '#2196f3',
    w: '#ffffff',
    k: '#fec107',
  },
  scale: 2,
};

const GENE_ICON: PixelIcon = {
  rows: [
    '............ww......',
    '...........w##w.....',
    '..........w#r#w.....',
    '.........w#lR#w.....',
    '........w#lrRr#w....',
    '........w#rR##r#ww..',
    '.......w#lr#r##r##w.',
    '......ww#rR##r##Bd#w',
    '....ww###RR###bBd#w.',
    '...w##BbbbbbbBbd#w..',
    '..w#Bbbddddddd##w...',
    '.w#Bbd###RR###ww....',
    'w#Bd##b##Rr#ww......',
    '.w##b##b#r#w........',
    '..ww#b#Rrl#w........',
    '....w#brl#w.........',
    '....w#rl#w..........',
    '.....w##w...........',
    '......ww............',
  ],
  palette: {
    w: '#ffffff',
    '#': '#1d1d1d',
    B: '#7394ca',
    b: '#3c63ae',
    d: '#203870',
  },
  scale: 2,
};

export const SUPPRESS_ICON: PixelIcon = {
  ...GENE_ICON,
  palette: { ...GENE_ICON.palette, r: '#bc2727', l: '#e04b4c', R: '#772220' },
};

export const DOMINATE_ICON: PixelIcon = {
  ...GENE_ICON,
  palette: { ...GENE_ICON.palette, r: '#3c9a45', l: '#5ac864', R: '#22602a' },
};
