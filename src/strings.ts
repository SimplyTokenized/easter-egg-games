/**
 * Strings for the easter egg, deliberately kept inside this folder.
 *
 * The app's i18n namespaces are loaded for every user on every page; a hidden
 * arcade has no business adding weight there. These live in the lazily loaded
 * arcade chunk instead and only ever reach the browser once someone finds the
 * egg. We reuse the app's current language, nothing more.
 */

const LANGUAGES = ["en", "de", "es", "fr", "ar"] as const;
export type EasterEggLanguage = (typeof LANGUAGES)[number];

export interface EasterEggStrings {
  arcadeTitle: string;
  arcadeSubtitle: string;
  comingSoon: string;
  play: string;
  close: string;
  chooseGame: string;
  resume: string;
  shortcutHint: string;
  backToArcade: string;
  loadingGame: string;
  solitaireName: string;
  solitaireDescription: string;
  snakeName: string;
  snakeDescription: string;
  memoryName: string;
  memoryDescription: string;
  puzzleName: string;
  puzzleDescription: string;
  newGame: string;
  undo: string;
  moves: string;
  time: string;
  autoFinish: string;
  howToPlay: string;
  wonTitle: string;
  wonSubtitle: string;
  playAgain: string;
  stock: string;
  waste: string;
  foundation: string;
  column: string;
  ladderName: string;
  ladderDescription: string;
  lads: string;
  levelLabel: string;
  scoreLabel: string;
  bonusLabel: string;
  jump: string;
  readyPrompt: string;
  gameOver: string;
  levelCleared: string;
  allCleared: string;
  ladderControls: string;
  lengthLabel: string;
  bestLabel: string;
  paused: string;
  boardFull: string;
  snakeControls: string;
  invadersName: string;
  invadersDescription: string;
  waveLabel: string;
  livesLabel: string;
  fire: string;
  waveCleared: string;
  invadersControls: string;
  invadersTouch: string;
}

const en: EasterEggStrings = {
  arcadeTitle: "Secret arcade",
  arcadeSubtitle: "Six clicks on the logo. Nicely done — take a break.",
  comingSoon: "Coming soon",
  play: "Play",
  close: "Close",
  chooseGame: "Choose your game",
  resume: "Continue",
  shortcutHint: "⌘Z undo · N new game · Esc close",
  backToArcade: "Back to the arcade",
  loadingGame: "Loading {game} …",
  solitaireName: "Solitaire",
  solitaireDescription:
    "Klondike, the classic. Move every card home to the four aces.",
  snakeName: "Snake",
  snakeDescription: "Eat, grow, don't bite yourself.",
  memoryName: "Memory",
  memoryDescription: "Find the matching pairs.",
  puzzleName: "2048",
  puzzleDescription: "Slide the tiles, chase the big number.",
  newGame: "New game",
  undo: "Undo",
  moves: "Moves",
  time: "Time",
  autoFinish: "Auto-finish",
  howToPlay:
    "Drag a card, or tap it and tap its destination. Double-tap sends it to the aces.",
  wonTitle: "You won!",
  wonSubtitle: "Every card is home. Time to head back to work — or not.",
  playAgain: "Play again",
  stock: "Stock",
  waste: "Waste",
  foundation: "Foundation",
  column: "Column",
  ladderName: "Ladder",
  ladderDescription:
    "Climb past the rolling rocks. A tribute to the 1983 terminal classic.",
  lads: "Lads",
  levelLabel: "Level",
  scoreLabel: "Score",
  bonusLabel: "Bonus",
  jump: "Jump",
  readyPrompt: "Press a key or tap to start",
  gameOver: "Game over",
  levelCleared: "Level cleared",
  allCleared: "All levels cleared!",
  ladderControls: "Arrows or WASD to move and climb · Space to jump",
  lengthLabel: "Length",
  bestLabel: "Best",
  paused: "Paused",
  boardFull: "The board is full — nothing left to eat!",
  snakeControls: "Point where you want to go · arrows or WASD · Space pauses",
  invadersName: "Space Invaders",
  invadersDescription:
    "Hold the line against the descending fleet. One shot at a time.",
  waveLabel: "Wave",
  livesLabel: "Lives",
  fire: "Fire",
  waveCleared: "Wave cleared",
  invadersControls: "Arrows or A/D to move · Space to fire",
  invadersTouch: "Drag anywhere on the screen — the cannon follows and fires",
};

const de: EasterEggStrings = {
  arcadeTitle: "Geheime Spielhalle",
  arcadeSubtitle: "Sechs Klicks aufs Logo. Gut gemacht — Zeit für eine Pause.",
  comingSoon: "Bald verfügbar",
  play: "Spielen",
  close: "Schließen",
  chooseGame: "Wähle dein Spiel",
  resume: "Weiterspielen",
  shortcutHint: "⌘Z Rückgängig · N Neues Spiel · Esc Schließen",
  backToArcade: "Zur Spielhalle",
  loadingGame: "{game} wird geladen …",
  solitaireName: "Solitär",
  solitaireDescription:
    "Klondike, der Klassiker. Alle Karten auf die vier Ass-Stapel.",
  snakeName: "Snake",
  snakeDescription: "Fressen, wachsen, sich nicht selbst beißen.",
  memoryName: "Memory",
  memoryDescription: "Finde die passenden Paare.",
  puzzleName: "2048",
  puzzleDescription: "Kacheln schieben, große Zahl jagen.",
  newGame: "Neues Spiel",
  undo: "Rückgängig",
  moves: "Züge",
  time: "Zeit",
  autoFinish: "Auto-Finish",
  howToPlay:
    "Karte ziehen — oder antippen und das Ziel antippen. Doppeltippen legt sie aufs Ass.",
  wonTitle: "Gewonnen!",
  wonSubtitle:
    "Alle Karten sind zu Hause. Zurück an die Arbeit — oder auch nicht.",
  playAgain: "Nochmal",
  stock: "Talon",
  waste: "Ablage",
  foundation: "Ass-Stapel",
  column: "Spalte",
  ladderName: "Ladder",
  ladderDescription:
    "Hoch, vorbei an rollenden Steinen. Hommage an den Terminal-Klassiker von 1983.",
  lads: "Leben",
  levelLabel: "Level",
  scoreLabel: "Punkte",
  bonusLabel: "Bonus",
  jump: "Sprung",
  readyPrompt: "Taste drücken oder tippen",
  gameOver: "Vorbei",
  levelCleared: "Level geschafft",
  allCleared: "Alle Level geschafft!",
  ladderControls:
    "Pfeiltasten oder WASD zum Laufen und Klettern · Leertaste springt",
  lengthLabel: "Länge",
  bestLabel: "Bestwert",
  paused: "Pause",
  boardFull: "Das Feld ist voll — nichts mehr zu fressen!",
  snakeControls: "Zeig, wohin es gehen soll · Pfeiltasten oder WASD · Leertaste pausiert",
  invadersName: "Space Invaders",
  invadersDescription:
    "Halte die Stellung gegen die absteigende Flotte. Immer nur ein Schuss.",
  waveLabel: "Welle",
  livesLabel: "Leben",
  fire: "Feuer",
  waveCleared: "Welle geschafft",
  invadersControls: "Pfeiltasten oder A/D zum Bewegen · Leertaste schießt",
  invadersTouch:
    "Finger über den Bildschirm ziehen — die Kanone folgt und feuert",
};

const es: EasterEggStrings = {
  arcadeTitle: "Sala de juegos secreta",
  arcadeSubtitle: "Seis clics en el logotipo. Bien hecho: tómate un descanso.",
  comingSoon: "Próximamente",
  play: "Jugar",
  close: "Cerrar",
  chooseGame: "Elige tu juego",
  resume: "Continuar",
  shortcutHint: "⌘Z deshacer · N nueva partida · Esc cerrar",
  backToArcade: "Volver a la sala",
  loadingGame: "Cargando {game} …",
  solitaireName: "Solitario",
  solitaireDescription:
    "Klondike, el clásico. Lleva todas las cartas a los cuatro ases.",
  snakeName: "Snake",
  snakeDescription: "Come, crece y no te muerdas.",
  memoryName: "Memoria",
  memoryDescription: "Encuentra las parejas.",
  puzzleName: "2048",
  puzzleDescription: "Desliza las fichas y busca el número grande.",
  newGame: "Nueva partida",
  undo: "Deshacer",
  moves: "Movimientos",
  time: "Tiempo",
  autoFinish: "Terminar solo",
  howToPlay:
    "Arrastra una carta, o tócala y toca su destino. Doble toque para enviarla a los ases.",
  wonTitle: "¡Has ganado!",
  wonSubtitle: "Todas las cartas en casa. Hora de volver al trabajo… o no.",
  playAgain: "Jugar otra vez",
  stock: "Mazo",
  waste: "Descarte",
  foundation: "Base",
  column: "Columna",
  ladderName: "Ladder",
  ladderDescription:
    "Sube esquivando las rocas. Homenaje al clásico de terminal de 1983.",
  lads: "Vidas",
  levelLabel: "Nivel",
  scoreLabel: "Puntos",
  bonusLabel: "Bono",
  jump: "Saltar",
  readyPrompt: "Pulsa una tecla o toca para empezar",
  gameOver: "Fin de la partida",
  levelCleared: "Nivel superado",
  allCleared: "¡Todos los niveles superados!",
  ladderControls: "Flechas o WASD para moverte y trepar · Espacio para saltar",
  lengthLabel: "Longitud",
  bestLabel: "Mejor",
  paused: "En pausa",
  boardFull: "El tablero está lleno: ¡no queda nada por comer!",
  snakeControls: "Señala adónde quieres ir · flechas o WASD · Espacio pausa",
  invadersName: "Space Invaders",
  invadersDescription:
    "Resiste ante la flota que desciende. Un disparo cada vez.",
  waveLabel: "Oleada",
  livesLabel: "Vidas",
  fire: "Disparar",
  waveCleared: "Oleada superada",
  invadersControls: "Flechas o A/D para moverte · Espacio para disparar",
  invadersTouch: "Arrastra por la pantalla: el cañón te sigue y dispara",
};

const fr: EasterEggStrings = {
  arcadeTitle: "Salle de jeux secrète",
  arcadeSubtitle: "Six clics sur le logo. Bien joué — faites une pause.",
  comingSoon: "Bientôt disponible",
  play: "Jouer",
  close: "Fermer",
  chooseGame: "Choisissez votre jeu",
  resume: "Continuer",
  shortcutHint: "⌘Z annuler · N nouvelle partie · Échap fermer",
  backToArcade: "Retour à la salle",
  loadingGame: "Chargement de {game} …",
  solitaireName: "Solitaire",
  solitaireDescription:
    "Klondike, le classique. Ramenez toutes les cartes sur les quatre as.",
  snakeName: "Snake",
  snakeDescription: "Mangez, grandissez, ne vous mordez pas.",
  memoryName: "Memory",
  memoryDescription: "Retrouvez les paires.",
  puzzleName: "2048",
  puzzleDescription: "Faites glisser les tuiles, visez le gros nombre.",
  newGame: "Nouvelle partie",
  undo: "Annuler",
  moves: "Coups",
  time: "Temps",
  autoFinish: "Terminer auto",
  howToPlay:
    "Faites glisser une carte, ou touchez-la puis sa destination. Double-clic pour l'envoyer sur les as.",
  wonTitle: "Gagné !",
  wonSubtitle: "Toutes les cartes sont rentrées. Retour au travail — ou pas.",
  playAgain: "Rejouer",
  stock: "Pioche",
  waste: "Défausse",
  foundation: "Fondation",
  column: "Colonne",
  ladderName: "Ladder",
  ladderDescription:
    "Grimpez en évitant les rochers. Hommage au classique terminal de 1983.",
  lads: "Vies",
  levelLabel: "Niveau",
  scoreLabel: "Score",
  bonusLabel: "Bonus",
  jump: "Sauter",
  readyPrompt: "Appuyez sur une touche ou touchez pour commencer",
  gameOver: "Partie terminée",
  levelCleared: "Niveau réussi",
  allCleared: "Tous les niveaux réussis !",
  ladderControls:
    "Flèches ou WASD pour se déplacer et grimper · Espace pour sauter",
  lengthLabel: "Longueur",
  bestLabel: "Record",
  paused: "En pause",
  boardFull: "Le plateau est plein — plus rien à manger !",
  snakeControls: "Montrez où aller · flèches ou WASD · Espace met en pause",
  invadersName: "Space Invaders",
  invadersDescription:
    "Tenez la ligne face à la flotte qui descend. Un seul tir à la fois.",
  waveLabel: "Vague",
  livesLabel: "Vies",
  fire: "Tirer",
  waveCleared: "Vague terminée",
  invadersControls: "Flèches ou A/D pour se déplacer · Espace pour tirer",
  invadersTouch: "Faites glisser le doigt : le canon suit et tire",
};

const ar: EasterEggStrings = {
  arcadeTitle: "صالة الألعاب السرية",
  arcadeSubtitle: "ست نقرات على الشعار. أحسنت — خذ استراحة.",
  comingSoon: "قريباً",
  play: "العب",
  close: "إغلاق",
  chooseGame: "اختر لعبتك",
  resume: "متابعة",
  shortcutHint: "⌘Z تراجع · N لعبة جديدة · Esc إغلاق",
  backToArcade: "العودة إلى الصالة",
  loadingGame: "جارٍ تحميل {game} …",
  solitaireName: "سوليتير",
  solitaireDescription:
    "كلوندايك الكلاسيكية. انقل كل الأوراق إلى أكوام الآس الأربعة.",
  snakeName: "الثعبان",
  snakeDescription: "كُل واكبر ولا تعضّ نفسك.",
  memoryName: "الذاكرة",
  memoryDescription: "اعثر على الأزواج المتطابقة.",
  puzzleName: "2048",
  puzzleDescription: "حرّك المربعات واسعَ إلى الرقم الكبير.",
  newGame: "لعبة جديدة",
  undo: "تراجع",
  moves: "النقلات",
  time: "الوقت",
  autoFinish: "إنهاء تلقائي",
  howToPlay:
    "اسحب ورقة، أو انقرها ثم انقر وجهتها. النقر المزدوج يرسلها إلى الآس.",
  wonTitle: "لقد فزت!",
  wonSubtitle: "كل الأوراق وصلت. حان وقت العودة للعمل — أو لا.",
  playAgain: "العب مجدداً",
  stock: "المجموعة",
  waste: "المهملات",
  foundation: "الأساس",
  column: "العمود",
  ladderName: "السلّم",
  ladderDescription:
    "اصعد متفادياً الصخور المتدحرجة. تحية لكلاسيكية الطرفية من عام 1983.",
  lads: "أرواح",
  levelLabel: "المستوى",
  scoreLabel: "النقاط",
  bonusLabel: "المكافأة",
  jump: "قفز",
  readyPrompt: "اضغط أي مفتاح أو انقر للبدء",
  gameOver: "انتهت اللعبة",
  levelCleared: "اكتمل المستوى",
  allCleared: "تم إنجاز كل المستويات!",
  ladderControls: "الأسهم أو WASD للحركة والتسلق · المسافة للقفز",
  lengthLabel: "الطول",
  bestLabel: "الأفضل",
  paused: "إيقاف مؤقت",
  boardFull: "امتلأت الرقعة — لم يبقَ ما يُؤكل!",
  snakeControls: "أشِر إلى وجهتك · الأسهم أو WASD · المسافة للإيقاف المؤقت",
  invadersName: "غزاة الفضاء",
  invadersDescription: "اصمد أمام الأسطول الهابط. طلقة واحدة في كل مرة.",
  waveLabel: "الموجة",
  livesLabel: "أرواح",
  fire: "إطلاق",
  waveCleared: "اكتملت الموجة",
  invadersControls: "الأسهم أو A/D للحركة · المسافة لإطلاق النار",
  invadersTouch: "اسحب إصبعك على الشاشة — يتبعك المدفع ويطلق النار",
};

const TABLE: Record<EasterEggLanguage, EasterEggStrings> = {
  en,
  de,
  es,
  fr,
  ar,
};

const isSupported = (value: string): value is EasterEggLanguage =>
  (LANGUAGES as readonly string[]).includes(value);

/** `de-AT` → `de`, anything unknown → English. */
export function getStrings(language: string | undefined): EasterEggStrings {
  const base = (language ?? "en").split("-")[0].toLowerCase();
  return isSupported(base) ? TABLE[base] : en;
}

/** Minimal `{placeholder}` substitution — no i18n runtime needed. */
export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
