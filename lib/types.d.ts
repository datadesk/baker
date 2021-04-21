export type NunjucksFilter = (...args) => unknown;
export type NunjucksTag = NunjucksFilter;
export type NunjucksBlockTag = (body: string, ...args) => unknown;

interface NunjucksExtensions {
  filters: Record<string, NunjucksFilter>;
  tags: Record<string, NunjucksTag>;
  blockTags: Record<string, NunjucksBlockTag>;
}
