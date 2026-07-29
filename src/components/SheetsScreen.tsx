import { useState } from "react";
import { PrintableSurveyMap } from "../map/PrintableSurveyMap";

interface ImageSheetProps {
  readonly number: "01" | "02";
  readonly baseName: "sheet01" | "sheet02";
  readonly description: string;
}

function ImageSheet({ baseName, description, number }: ImageSheetProps) {
  const [missing, setMissing] = useState(false);

  return (
    <section
      className="prop-sheet prop-sheet--image"
      aria-label={`Printable prop sheet ${number}`}
      data-sheet={number}
      data-asset={baseName}
    >
      <h1 className="prop-sheet__accessible-title">Sheet {number}</h1>
      {missing ? (
        <div className="prop-sheet__missing" role="img" aria-label={description}>
          <strong>SHEET {number} SOURCE MISSING</strong>
          <span>Place {baseName}.png in the local media output.</span>
        </div>
      ) : (
        <picture className="prop-sheet__picture">
          <source
            srcSet={`/media/${baseName}.webp`}
            type="image/webp"
          />
          <img
            className="prop-sheet__image"
            src={`/media/${baseName}.png`}
            alt={description}
            draggable={false}
            onError={() => setMissing(true)}
          />
        </picture>
      )}
    </section>
  );
}

export function SheetsScreen() {
  return (
    <main className="sheets-screen" aria-label="Three printable prop sheets">
      <ImageSheet
        number="01"
        baseName="sheet01"
        description="A crude crayon drawing of a faceless crawling figure with a vertical mouth."
      />
      <ImageSheet
        number="02"
        baseName="sheet02"
        description="A crude pressed botanical specimen page showing one three-lobed leaf."
      />
      <section
        className="prop-sheet prop-sheet--survey"
        aria-label="Printable prop sheet 03, the Host's master survey"
        data-sheet="03"
      >
        <h1 className="prop-sheet__accessible-title">Sheet 03</h1>
        <PrintableSurveyMap />
        <div
          className="pressed-text-area"
          aria-label="Setup-only blank pressed-text area"
        >
          <i className="pressed-text-area__tick pressed-text-area__tick--north-west" />
          <i className="pressed-text-area__tick pressed-text-area__tick--north-east" />
          <i className="pressed-text-area__tick pressed-text-area__tick--south-west" />
          <i className="pressed-text-area__tick pressed-text-area__tick--south-east" />
          <span>press text here</span>
        </div>
      </section>
    </main>
  );
}

export default SheetsScreen;
