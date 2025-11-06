/**
 * Memory-efficient file reader using the File API
 * Reads only the bytes needed.
 */

export interface ByteRange {
  start: number;
  end: number;
}

export class ByteReader {
  constructor(public file: File) {}

  /**
   * Read a specific range of bytes from the file
   * @param start - Starting byte position
   * @param end - Ending byte position (exclusive)
   * @returns Promise<string> - The file content as text
   */
  async readBytesAsText(start: number, end: number): Promise<string> {
    const blob = this.file.slice(start, end);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(reader.result as string);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
  }

  /**
   * Read a specific range of bytes from the file as ArrayBuffer
   * @param start - Starting byte position
   * @param end - Ending byte position (exclusive)
   * @returns Promise<ArrayBuffer>
   */
  async readBytesAsBuffer(start: number, end: number): Promise<ArrayBuffer> {
    const blob = this.file.slice(start, end);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(reader.result as ArrayBuffer);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Get file size
   */
  getSize(): number {
    return this.file.size;
  }

  /**
   * Get file name
   */
  getName(): string {
    return this.file.name;
  }
}
