import {
  KALLAX_KEY_GLYPH_INDEX,
  kallaxGlyphs,
} from "@/src/glyphs";
import { GameIcon } from "./GameIcon";

function formatIndex(index: number): string {
  return String(index).padStart(2, "0");
}

export function GlyphsScreen() {
  const keyGlyph = kallaxGlyphs.find(
    (glyph) => glyph.index === KALLAX_KEY_GLYPH_INDEX,
  );

  return (
    <main className="glyphs-screen" aria-labelledby="glyphs-title">
      <header className="glyphs-screen__header">
        <p className="glyphs-screen__eyebrow">ROOM SETUP // KALLAX LABELS</p>
        <h1 id="glyphs-title">Sixteen shelf marks</h1>
        <p>
          Print at actual size. Cut on the hairlines. Tape one mark to each
          Kallax cell.
        </p>
      </header>

      <div className="glyphs-screen__pages">
        <section
          className="glyph-page glyph-page--labels"
          aria-label="Printable Kallax glyph labels"
        >
          <ol className="glyph-labels">
            {kallaxGlyphs.map((glyph) => (
              <li className="glyph-label" key={glyph.index}>
                <figure>
                  <GameIcon
                    name={glyph.icon}
                    className="glyph-label__icon"
                    ariaLabel={`Abstract glyph ${formatIndex(glyph.index)}`}
                  />
                  <figcaption>{formatIndex(glyph.index)}</figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="glyph-page glyph-page--key"
          aria-labelledby="glyph-key-title"
        >
          <div className="glyph-key__warning">SETUP ONLY // DO NOT LEAVE IN PLAY</div>
          <p className="glyph-key__eyebrow">BLUE KEYCARD PLACEMENT</p>
          <h2 id="glyph-key-title">Tape the keycard behind this cell.</h2>
          {keyGlyph && (
            <figure className="glyph-key__figure">
              <GameIcon
                name={keyGlyph.icon}
                className="glyph-key__icon"
                ariaLabel={`Correct Kallax glyph ${formatIndex(keyGlyph.index)}`}
              />
              <figcaption>
                GLYPH INDEX <strong>{formatIndex(keyGlyph.index)}</strong>
              </figcaption>
            </figure>
          )}
          <p className="glyph-key__instruction">
            Put the blue keycard inside the Kallax cell carrying this label.
            Remove this setup sheet before the game begins.
          </p>
        </section>
      </div>
    </main>
  );
}
