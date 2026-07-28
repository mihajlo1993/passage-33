'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { printablePins } from '../pins';
import { pinPayload } from '../scanner/payload';
import { colours } from '../tokens';
import { zoneById } from '../zones';

const CODES_PER_PAGE = 4;

type CodeImages = Readonly<Record<number, string>>;

function formatPinId(id: number): string {
  return String(id).padStart(2, '0');
}

function pagesOfFour<T>(entries: readonly T[]): readonly (readonly T[])[] {
  return Array.from(
    { length: Math.ceil(entries.length / CODES_PER_PAGE) },
    (_, pageIndex) => {
      const firstEntry = pageIndex * CODES_PER_PAGE;
      return entries.slice(firstEntry, firstEntry + CODES_PER_PAGE);
    },
  );
}

const pinPages = pagesOfFour(printablePins);

export function CodesScreen() {
  const [codeImages, setCodeImages] = useState<CodeImages>({});
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    let isCurrentAttempt = true;

    async function generateCodes() {
      try {
        const generatedEntries = await Promise.all(
          printablePins.map(async (pin) => {
            const payload = pinPayload(pin.id);
            const image = await QRCode.toDataURL(payload, {
              errorCorrectionLevel: 'M',
              color: {
                dark: colours.void,
                light: colours.bone,
              },
            });

            return [pin.id, image] as const;
          }),
        );

        if (isCurrentAttempt) {
          setCodeImages(Object.fromEntries(generatedEntries));
          setIsGenerating(false);
        }
      } catch (error) {
        if (isCurrentAttempt) {
          setGenerationError(
            error instanceof Error
              ? error.message
              : 'The QR codes could not be generated.',
          );
          setIsGenerating(false);
        }
      }
    }

    void generateCodes();

    return () => {
      isCurrentAttempt = false;
    };
  }, [generationAttempt]);

  if (isGenerating) {
    return (
      <main className="codes-screen codes-screen--loading">
        <p className="codes-screen__status" role="status" aria-live="polite">
          Preparing {printablePins.length} local QR codes...
        </p>
      </main>
    );
  }

  if (generationError) {
    return (
      <main className="codes-screen codes-screen--error">
        <div className="codes-screen__error" role="alert">
          <h1>Code generation failed</h1>
          <p>{generationError}</p>
          <button
            className="codes-screen__retry"
            type="button"
            onClick={() => {
              setCodeImages({});
              setGenerationError(null);
              setIsGenerating(true);
              setGenerationAttempt((attempt) => attempt + 1);
            }}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="codes-screen">
      <header className="codes-screen__header">
        <p className="codes-screen__eyebrow">Baker House placement set</p>
        <h1>QR codes</h1>
        <p>{printablePins.length} codes // four per print page</p>
      </header>

      <div className="codes-screen__pages">
        {pinPages.map((page, pageIndex) => (
          <section
            className="code-page"
            key={`code-page-${pageIndex + 1}`}
            aria-label={`QR code print page ${pageIndex + 1} of ${pinPages.length}`}
          >
            <ol className="code-page__grid">
              {page.map((pin) => {
                const formattedId = formatPinId(pin.id);
                const payload = pinPayload(pin.id);
                const zoneName = zoneById[pin.zone].name;

                return (
                  <li className="code-card" key={pin.id}>
                    <figure className="code-card__figure">
                      {/* A locally generated data URL cannot use an image optimiser. */}
                      <img
                        className="code-card__qr"
                        src={codeImages[pin.id]}
                        alt={`QR code for PIN ${formattedId}, ${pin.name}, ${zoneName}. Encodes ${payload}.`}
                        draggable={false}
                      />
                      <figcaption className="code-card__caption">
                        <span className="code-card__pin">
                          PIN {formattedId}
                        </span>
                        <span className="code-card__location">
                          {pin.name}
                        </span>
                        <span className="code-card__zone">{zoneName}</span>
                      </figcaption>
                    </figure>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}

export default CodesScreen;
