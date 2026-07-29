/* Deterministic build output. Run node scripts/generate-ar-assets.mjs; do not edit. */

export const generatedArAssets = {
  "sheetOrder": [
    "sheet01",
    "sheet02"
  ],
  "sheets": {
    "sheet01": {
      "spriteUrl": "/ar/sprites/sheet01.webp",
      "width": 512,
      "height": 724,
      "byteLength": 78242,
      "placeholder": false,
      "spriteSha256": "72742f825226ad528c9063d348308257039013a6bc93aa5d501b7ab001c8a8f8",
      "sourceFileName": "assets-incoming/sheet01.png",
      "maskFileName": null,
      "sourceMode": "incoming"
    },
    "sheet02": {
      "spriteUrl": "/ar/sprites/sheet02.webp",
      "width": 512,
      "height": 724,
      "byteLength": 9384,
      "placeholder": true,
      "spriteSha256": "2a8a55bc28534ed4323356aefe7551716b63a41fe5eb8e553c37bdb5e5aa786e",
      "sourceFileName": "sheet02.png",
      "maskFileName": null,
      "sourceMode": "placeholder"
    }
  },
  "creature": {
    "url": "/ar/textures/creature.webp",
    "width": 1024,
    "height": 2048,
    "byteLength": 167564,
    "placeholder": false,
    "blackKeyed": true,
    "sha256": "8fc8a7f6d84b3cf5ca263397f021bcdc38ac9df4af3aadbd1252eabe26d5b44c",
    "sourcePngSha256": "c0e4a81439ebd2cb6a916abe96ea49389a058a387df790be8e39fa17c47fa546",
    "sourceFileName": "creature.png"
  },
  "sourceMode": {
    "sheet01": "incoming",
    "sheet02": "placeholder",
    "creature": "source"
  }
} as const;
