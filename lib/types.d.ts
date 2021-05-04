export type BakerMode = 'production' | 'development';

export type NunjucksFilter = (...args) => unknown;
export type NunjucksTag = NunjucksFilter;
export type NunjucksBlockTag = (body: string, ...args) => unknown;

interface NunjucksExtensions {
  filters: Record<string, NunjucksFilter>;
  tags: Record<string, NunjucksTag>;
  blockTags: Record<string, NunjucksBlockTag>;
}

type createPage = (
  template: string,
  outputFileName: string,
  context: any
) => void;

interface BakerOptions {
  createPages?: (createPage: createPage, context: any) => void;
  data: string;
  domain?: string;
  entrypoints: string;
  input: string;
  layouts: string;
  nunjucks: NunjucksExtensions;
  output: string;
  pathPrefix: string;
  staticRoot: string;
}
