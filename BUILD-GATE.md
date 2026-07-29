# Production build gate

Measured from a production build on 2026-07-29. Verification was limited to build, Node tests, and static scans.

## Result

- npm test: PASS - 153 tests passed, 0 failed.
- npm run build: PASS.
- Main entry: /assets/index-DQGaazP-.js - 443,397 bytes; PASS (under 2,000,000).
- Unique service-worker precache: 6,670,281 bytes across 76 unique files; PASS (under 8,000,000).
- Service-worker declarations: 77; manifest.webmanifest is declared twice and counted once.
- Build warning: sheet02 is the only placeholder prop sheet.

## Exclusion scan

- PASS: no media/sheet01.* or media/sheet02.* entry.
- PASS: no print-route JavaScript or CSS entry.
- PASS: no PNG entry except icons/icon-192.png and icons/icon-512.png.

## Full unique service-worker precache manifest

| File | Bytes |
| --- | ---: |
| registerSW.js | 134 |
| manifest.webmanifest | 598 |
| index.html | 1545 |
| media/trophy.webp | 109532 |
| media/tape-07.webp | 21882 |
| media/tape-06.webp | 12140 |
| media/tape-05.webp | 16066 |
| media/tape-04.webp | 14614 |
| media/tape-03.webp | 11180 |
| media/tape-02.webp | 11822 |
| media/tape-01.webp | 14806 |
| media/cold-open.webp | 63360 |
| audio/voice/trophy.mp3 | 491520 |
| audio/voice/tape.mp3 | 1166733 |
| audio/voice/present.mp3 | 398106 |
| audio/voice/draught.mp3 | 329769 |
| audio/voice/cold-open.mp3 | 471458 |
| audio/oneshot/write.wav | 141164 |
| audio/oneshot/stinger-c.wav | 123524 |
| audio/oneshot/stinger-b.wav | 308744 |
| audio/oneshot/stinger-a.wav | 194084 |
| audio/oneshot/released.wav | 61784 |
| audio/oneshot/refused.wav | 35324 |
| audio/oneshot/heartbeat.wav | 123524 |
| audio/oneshot/found.wav | 15920 |
| audio/oneshot/drag.wav | 247004 |
| audio/oneshot/dial-tick.wav | 7982 |
| audio/ir/living.wav | 32444 |
| audio/ir/kitchen.wav | 25244 |
| audio/ir/entry.wav | 21644 |
| audio/ir/corridor.wav | 43244 |
| audio/ir/bathroom.wav | 27644 |
| audio/ir/balcony.wav | 62444 |
| assets/useSharedCameraVideo-sLklXpEk.js | 2726 |
| assets/special-elite-latin-ext-400-normal-ChcxYnmu.woff2 | 25196 |
| assets/special-elite-latin-ext-400-normal-CaJZjSVf.woff | 29992 |
| assets/special-elite-latin-400-normal-YjDd9tmf.woff2 | 53296 |
| assets/special-elite-latin-400-normal-BtSRmyJ6.woff | 63412 |
| assets/RoomARScreen-CMyfIjnY.js | 473069 |
| assets/rolldown-runtime-S-ySWqyJ.js | 694 |
| assets/index-DQGaazP-.js | 443397 |
| assets/index-BGovKdRm.css | 48620 |
| assets/ImageARScreen-DHn5EaWh.js | 2966 |
| assets/courier-prime-latin-ext-700-normal-ByMJlNdM.woff2 | 12928 |
| assets/courier-prime-latin-ext-700-normal-BIFoAzHx.woff | 9280 |
| assets/courier-prime-latin-ext-400-normal-CKOCNFvK.woff | 9044 |
| assets/courier-prime-latin-ext-400-normal-B-EsvyE4.woff2 | 12736 |
| assets/courier-prime-latin-700-normal-D1YCjmaD.woff2 | 19348 |
| assets/courier-prime-latin-700-normal-CVvp4Sof.woff | 14676 |
| assets/courier-prime-latin-400-normal-BbyBr73r.woff2 | 18640 |
| assets/courier-prime-latin-400-normal-BAlbUm6l.woff | 14380 |
| assets/config-DmGER5rX.js | 768 |
| assets/ARScreen-6TVcIMLn.js | 3036 |
| assets/archivo-narrow-vietnamese-700-normal-VsvP8OcS.woff2 | 4356 |
| assets/archivo-narrow-vietnamese-700-normal-CB0yIOvF.woff | 6124 |
| assets/archivo-narrow-vietnamese-600-normal-BOVNaV0C.woff | 6244 |
| assets/archivo-narrow-vietnamese-600-normal-B3iMS2rD.woff2 | 4428 |
| assets/archivo-narrow-vietnamese-400-normal-uH49xrTy.woff2 | 4336 |
| assets/archivo-narrow-vietnamese-400-normal-C2Bhhhro.woff | 6072 |
| assets/archivo-narrow-latin-ext-700-normal-DCLoHMFv.woff2 | 10852 |
| assets/archivo-narrow-latin-ext-700-normal-C4q0W15T.woff | 14768 |
| assets/archivo-narrow-latin-ext-600-normal-DNmONYTo.woff2 | 11036 |
| assets/archivo-narrow-latin-ext-600-normal-CFDqFZjW.woff | 15140 |
| assets/archivo-narrow-latin-ext-400-normal-DO6227My.woff | 14768 |
| assets/archivo-narrow-latin-ext-400-normal-BzcuidUP.woff2 | 10756 |
| assets/archivo-narrow-latin-700-normal-DxmyBkwC.woff | 15196 |
| assets/archivo-narrow-latin-700-normal-DtADLsoy.woff2 | 11776 |
| assets/archivo-narrow-latin-600-normal-l2jiltzb.woff2 | 12096 |
| assets/archivo-narrow-latin-600-normal-DZkbuzR9.woff | 15540 |
| assets/archivo-narrow-latin-400-normal-nNe3qgr1.woff | 15280 |
| assets/archivo-narrow-latin-400-normal-BON_owyT.woff2 | 11796 |
| ar/textures/creature.webp | 167564 |
| ar/sprites/sheet02.webp | 9384 |
| ar/sprites/sheet01.webp | 78242 |
| icons/icon-192.png | 41274 |
| icons/icon-512.png | 318066 |
