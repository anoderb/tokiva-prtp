import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

/**
 * BarcodeScanner utility wrapping @zxing/browser to simplify barcode scanning on webcam streams.
 */
export class BarcodeScanner {
  private reader: BrowserMultiFormatReader;
  private controls: IScannerControls | null = null;

  constructor() {
    this.reader = new BrowserMultiFormatReader();
  }

  /**
   * Starts scanning barcodes from the specified video element.
   * Calls onScanSuccess when a barcode is found.
   */
  async start(
    videoElement: HTMLVideoElement,
    onScanSuccess: (text: string) => void
  ): Promise<void> {
    try {
      this.stop(); // Stop any active scanner before launching a new one.

      console.log('Starting barcode scanner...');
      this.controls = await this.reader.decodeFromVideoDevice(
        undefined, // undefined selects the default camera device (often back camera on mobile)
        videoElement,
        (result, error) => {
          if (result) {
            const text = result.getText();
            console.log('Barcode scanned:', text);
            onScanSuccess(text);
          }
          // Errors are frequently thrown when no barcode is in frame (e.g. NotFoundException).
          // We ignore them to keep scanning smoothly.
        }
      );
    } catch (error) {
      console.error('Error starting barcode scanner:', error);
      throw error;
    }
  }

  /**
   * Stops scanning and stops camera stream tracks.
   */
  stop(): void {
    if (this.controls) {
      console.log('Stopping barcode scanner...');
      this.controls.stop();
      this.controls = null;
    }
  }
}
