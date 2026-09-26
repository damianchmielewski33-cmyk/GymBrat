declare module "word-extractor" {
  class Document {
    getBody(options?: { includeHeaders?: boolean }): string;
    getHeaders(options?: { includeFooters?: boolean }): string;
    getFootnotes(): string;
    getAnnotations(): string;
  }

  export default class WordExtractor {
    extract(input: Buffer | string): Promise<Document>;
  }
}
