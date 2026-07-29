import { PrintableSurveyMap } from "../map/PrintableSurveyMap";
import { MEDIA_ASSETS } from "../media/assets";

interface ImageSheetProps {
  readonly number: "01" | "02";
  readonly baseName: "sheet01" | "sheet02";
  readonly description: string;
}

function ImageSheet({ baseName, description, number }: ImageSheetProps) {
  const asset = MEDIA_ASSETS[baseName];
  return (
    <section
      className="prop-sheet prop-sheet--image"
      aria-label={`Printable prop sheet ${number}`}
      data-sheet={number}
      data-asset={baseName}
    >
      <h1 className="prop-sheet__accessible-title">Sheet {number}</h1>
      {asset.available ? (
        <img
          className="prop-sheet__image"
          src={asset.png.url}
          alt={description}
          draggable={false}
        />
      ) : (
        <div
          className="prop-sheet__missing"
          role="img"
          aria-label={`${description} Source asset missing.`}
        >
          <strong>Sheet {number}</strong>
          <span>Source missing</span>
        </div>
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
