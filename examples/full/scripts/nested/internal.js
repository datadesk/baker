export async function getData() {
  const data = await import('dataset:../cdcr.json');
  return data;
}
