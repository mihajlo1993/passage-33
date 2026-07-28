declare module 'qrcode' {
  interface QRCodeColourOptions {
    dark?: string;
    light?: string;
  }

  interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    color?: QRCodeColourOptions;
  }

  interface QRCodeApi {
    create(
      text: string,
      options?: QRCodeToDataURLOptions,
    ): {
      modules: {
        size: number;
        data: Uint8Array;
      };
    };

    toDataURL(
      text: string,
      options?: QRCodeToDataURLOptions,
    ): Promise<string>;
  }

  const QRCode: QRCodeApi;
  export default QRCode;
}


declare module 'virtual:game-icons' {
  import type { IconifyJSON } from '@iconify/types';

  const gameIcons: IconifyJSON;
  export default gameIcons;
}
