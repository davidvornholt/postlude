/**
 * What a made-up evening is about. Every person, place and event here is
 * invented, and none of it comes from a real journal. The text is German
 * because the journal is written in German (`journal-language.ts`).
 *
 * A topic with a season only turns up in its months, so the garden grows in
 * summer and the snow falls in winter, and work happens on workdays.
 */

/** Months `from` through `to`, numbered from 1, wrapping past December. */
export type Season = { readonly from: number; readonly to: number };

export const inSeason = ({ from, to }: Season, month: number): boolean =>
  from <= to ? from <= month && month <= to : month >= from || month <= to;

export type EveningTopic = {
  readonly heading: string;
  readonly season?: Season;
  readonly workdaysOnly?: boolean;
  readonly sentences: ReadonlyArray<string>;
};

const gardening: Season = { from: 4, to: 10 };
const summer: Season = { from: 6, to: 8 };
const winter: Season = { from: 12, to: 2 };
const autumn: Season = { from: 9, to: 11 };

export const eveningTopics: ReadonlyArray<EveningTopic> = [
  {
    heading: 'Garten',
    season: gardening,
    sentences: [
      'Nach der Arbeit war ich noch {eine Stunde|kurz|bis zur Dämmerung} im Garten.',
      'Die {Tomaten|Bohnen|Zucchini|Erdbeeren} {wachsen schneller als gedacht|brauchen dringend Stützen|haben endlich Blüten angesetzt}.',
      'Ich habe {Unkraut gejätet|die Beete gegossen|den Kompost umgesetzt|den Rasen gemäht}, und es war dabei {herrlich still|angenehm kühl|überraschend warm}.',
      'Der Apfelbaum {hängt dieses Jahr voller Früchte|hat die kalte Nacht gut überstanden|muss im Herbst dringend geschnitten werden}.',
      'Lea hat {Sonnenblumen|Kapuzinerkresse|Radieschen} gesät und schaut jeden Morgen nach, ob schon etwas zu sehen ist.',
      'Die Schnecken haben {den Salat|die jungen Kohlrabi|das Basilikum} fast komplett erwischt.',
      'Ich will mir {ein Hochbeet|eine Regentonne|einen zweiten Komposter} bauen, sobald ich ein freies Wochenende finde.',
      'Der Nachbar hat mir {Ableger von seinem Rhabarber|ein paar Zwiebeln|einen Korb Johannisbeeren} über den Zaun gereicht.',
    ],
  },
  {
    heading: 'Küche',
    sentences: [
      'Heute Abend habe ich {ein Roggenbrot|ein Dinkelbrot|Brötchen für das Wochenende|eine Focaccia} gebacken.',
      'Der Sauerteig war {träge|sehr lebendig|fast vergessen im Kühlschrank} und brauchte {zwei Fütterungen|eine Nacht im Warmen|einfach etwas Geduld}.',
      'Die Kruste ist {schön dunkel geworden|etwas zu hell geblieben|wunderbar aufgerissen}, die Krume {luftig|eher dicht|saftig}.',
      'Zum Abendessen gab es {Linsensuppe|Ofengemüse mit Feta|Spinatknödel|Kartoffelgratin|Pfannkuchen mit Apfelmus}.',
      'Jonas hat gekocht, und ich musste nur {den Tisch decken|abwaschen|den Salat machen}.',
      'Das Rezept aus dem {alten Kochbuch|Heft von Oma Hilde} funktioniert immer noch am besten.',
      'Ich habe {zu viel Salz|zu wenig Knoblauch|eine Prise Muskat zu viel} erwischt, aber gegessen wurde trotzdem alles.',
    ],
  },
  {
    heading: 'Unterwegs',
    sentences: [
      'Ich bin {mit dem Rad zur Arbeit gefahren|eine Runde am Kanal entlang geradelt|früh laufen gewesen|nach Feierabend schwimmen gewesen}.',
      'Die Strecke über {die Felder|den Deich|den Stadtwald} war {voller Pfützen|herrlich leer|windiger als erwartet}.',
      'Nach {zwanzig|dreißig|fünfundvierzig} Kilometern waren die Beine schwer, aber der Kopf war frei.',
      'Am Hinterrad muss ich {den Schlauch flicken|die Bremse nachstellen|endlich die Kette ölen}.',
      'Unterwegs habe ich {einen Fuchs|zwei Rehe am Waldrand|einen Reiher im Graben} gesehen.',
      'Die Bahn war {pünktlich, was mich fast überrascht hat|wieder einmal ausgefallen|so voll, dass ich stehen musste}.',
    ],
  },
  {
    heading: 'Arbeit',
    workdaysOnly: true,
    sentences: [
      'Im Büro ging es fast den ganzen Tag um {das neue Abrechnungsmodul|die Umstellung der Server|den Quartalsbericht|die Planung für das Frühjahr}.',
      'Das Gespräch mit {Mira|Tobias|Frau Albers} war {klarer als befürchtet|anstrengend, aber ehrlich|richtig gut}.',
      'Ich habe {endlich den Fehler im Export gefunden|drei offene Aufgaben abgeschlossen|lange an einem Konzept gefeilt|zu viel Zeit in Besprechungen verbracht}.',
      'Am Nachmittag konnte ich {zwei Stunden ungestört arbeiten|kaum einen Gedanken zu Ende bringen|die Änderung am Kalender fertig machen}.',
      'Morgen steht {die Präsentation|das Gespräch mit Herrn Brandt|ein Workshop mit dem neuen Team|die Übergabe an Tobias} an.',
      'Ich merke, dass ich {mir die Pausen besser einteilen sollte|nach dem Mittagessen immer müde werde|mit einer klaren Liste viel ruhiger bin}.',
      'Mira hat {Kuchen mitgebracht|eine gute Frage gestellt, über die ich noch nachdenke|mir beim Testen geholfen}.',
    ],
  },
  {
    heading: 'Familie',
    sentences: [
      'Am Abend haben wir mit {Oma Hilde|meinen Eltern|Lena und Jonas} telefoniert.',
      '{Clara|Ben} hat {uns zum Essen eingeladen|beim Umzug Hilfe gebraucht|von der Reise nach Lissabon erzählt}.',
      'Wir haben {ein Brettspiel gespielt|lange auf dem Balkon gesessen|alte Fotos angeschaut}, bis es dunkel wurde.',
      'Es tut gut, {Zeit ohne Plan zu haben|einfach zuzuhören|mal wieder richtig zu lachen}.',
      'Lea hat {ein Bild für Oma Hilde gemalt|stolz ihr erstes Gedicht vorgelesen|beim Kuchenbacken mehr Teig genascht als gerührt}.',
      'Das Wochenende bei {meinen Eltern|Clara und Ben|Tante Ruth} ist schon fest eingeplant.',
    ],
  },
  {
    heading: 'Lesen',
    sentences: [
      'Vor dem Schlafen habe ich {zwanzig Seiten|ein ganzes Kapitel|eine halbe Stunde} in {dem Buch über Leuchttürme|dem Roman, den Clara mir empfohlen hat|der Geschichte der Kartografie} gelesen.',
      'Ich lese gerade langsamer, aber {aufmerksamer|mit mehr Freude|mit dem Bleistift in der Hand}.',
      'Ein Gedanke aus dem Buch ist hängen geblieben: Ordnung entsteht nicht auf einmal, sondern durch kleine Wiederholungen.',
      'In der Bibliothek habe ich {zwei Bücher zurückgegeben und drei neue ausgeliehen|eine Ausstellung über alte Landkarten entdeckt|eine Stunde einfach nur gestöbert}.',
      'Der Krimi von {der Nachbarin|Tante Ruth} ist spannender, als der Umschlag vermuten lässt.',
    ],
  },
  {
    heading: 'Musik',
    sentences: [
      'Ich habe {eine halbe Stunde Klavier geübt|endlich wieder Gitarre gespielt|mit Lea Flöte geübt}.',
      '{Die linke Hand|Der Rhythmus im Mittelteil|Der Übergang zur zweiten Strophe} sitzt noch nicht, aber es wird.',
      'Bei der Chorprobe haben wir {den Einsatz zweimal verpasst|zum ersten Mal das ganze Stück gesungen|ein neues Lied für das Gemeindefest angefangen}.',
      'Auf dem Heimweg lief im Radio {ein altes Lied von früher|eine Sinfonie, die ich nicht kannte|ein Interview mit einer Organistin}.',
    ],
  },
  {
    heading: 'Wetter',
    sentences: [
      'Den ganzen Tag {Nieselregen|Sonne|grauer Himmel|stürmischer Wind|Nebel bis zum Mittag}.',
      'Abends {klarte es auf|hat es kräftig geregnet|wurde es empfindlich kühl}, und ich habe {die Jacke|den Schirm|einen Pullover} gebraucht.',
      'Das Licht am späten Nachmittag war {golden|ganz weich|seltsam gelb}, und ich bin extra noch einmal vor die Tür gegangen.',
    ],
  },
  {
    heading: 'Sommer',
    season: summer,
    sentences: [
      'Es war {drückend heiß|der wärmste Tag des Jahres|schwül bis in die Nacht}, und im Büro lief der Ventilator ohne Pause.',
      'Nach Feierabend sind wir {an den Baggersee|ins Freibad|an den Fluss} gefahren.',
      'Zum Abschluss gab es {ein Eis am Markt|Wassermelone auf dem Balkon|kalten Pfefferminztee}.',
      'Die Gewitterwolken haben sich {erst nach Mitternacht|zum Glück erst nach dem Grillen|schon am Nachmittag} entladen.',
    ],
  },
  {
    heading: 'Winter',
    season: winter,
    sentences: [
      'Heute Morgen lag {eine dünne Schneeschicht|Raureif|Frost} auf den Autoscheiben.',
      'Wir haben {Plätzchen gebacken|den Adventskranz gebunden|Tee getrunken und Karten geschrieben}.',
      'Mit Lea war ich {Schlitten fahren|auf dem zugefrorenen Teich|beim Weihnachtsmarkt in der Altstadt}.',
      'Um vier ist es schon dunkel, und ich merke, wie sehr mir das Licht fehlt.',
    ],
  },
  {
    heading: 'Herbst',
    season: autumn,
    sentences: [
      'Wir haben {Äpfel geerntet und eingekocht|Kastanien gesammelt|Laub gerecht, bis die Hände kalt waren}.',
      'Der Wald riecht schon nach {Pilzen|nassem Laub|Rauch aus den Kaminen}.',
      'Aus den Äpfeln ist {ein großer Topf Apfelmus|ein Blechkuchen|Saft für den ganzen Winter} geworden.',
    ],
  },
  {
    heading: 'Zuhause',
    sentences: [
      'Ich habe {die Steuerunterlagen sortiert|den Keller aufgeräumt|die Fenster geputzt|die tropfende Spüle repariert|den Wocheneinkauf erledigt}.',
      'Die Liste für das Wochenende wird {länger statt kürzer|langsam überschaubar|schon wieder unübersichtlich}.',
      'Der Handwerker kommt {erst nächste Woche|morgen früh|irgendwann zwischen acht und zwölf}, was den Tag etwas zerreißt.',
      'Endlich hängt {das Regal im Flur|die neue Lampe über dem Esstisch|das Bild von Oma Hilde}.',
    ],
  },
  {
    heading: 'Ausflug',
    sentences: [
      'Wir sind {an den See|in die Altstadt|zum Wochenmarkt|auf den Hausberg} {gefahren|gewandert|spaziert}.',
      'Im {kleinen Café am Markt|Gasthaus am Waldrand|Hofladen an der Landstraße} gab es {Apfelkuchen|Flammkuchen|Kaiserschmarrn}.',
      'Auf dem Rückweg {hat es angefangen zu regnen|haben wir uns kurz verlaufen|stand die Sonne tief über den Feldern}.',
      'Den Tag möchte ich mir merken, weil {nichts geplant war und alles gepasst hat|alle gute Laune hatten|ich ganz bei der Sache war}.',
    ],
  },
];

/** Sentences that close an evening, whatever it was about. */
export const closingSentences: ReadonlyArray<string> = [
  'Insgesamt ein {guter|zäher|gemischter|stiller|ziemlich voller} Tag.',
  'Ich bin dankbar für {den ruhigen Morgen|ein gutes Gespräch|die Gesundheit|die Menschen um mich herum}.',
  'Was mich heute beschäftigt hat: {ob ich mir zu viel vornehme|wie ich mehr Ruhe in die Woche bekomme|was eigentlich wirklich wichtig ist}.',
  'Morgen will ich {früher ins Bett|weniger aufs Handy schauen|mit dem Wichtigsten anfangen|mir mehr Zeit für das Frühstück nehmen}.',
];

/** Things that can go on a checklist, ticked or not. */
export const listItems: ReadonlyArray<string> = [
  'Steuererklärung abschicken',
  'Fahrrad zur Werkstatt bringen',
  'Oma Hilde zurückrufen',
  'Geschenk für Ben besorgen',
  'Sauerteig füttern',
  'Bücher in die Bibliothek bringen',
  'Wasserzähler ablesen',
  'Tomaten hochbinden',
  'Präsentation für Herrn Brandt vorbereiten',
  'Termin beim Zahnarzt ausmachen',
  'Winterreifen aufziehen lassen',
  'Noten für die Chorprobe kopieren',
];
