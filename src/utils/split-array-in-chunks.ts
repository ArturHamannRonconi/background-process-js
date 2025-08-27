export const splitArrayInChunks = <T>(
  array: Array<T>,
  size: number,
): Array<T[]> => {
  if (size <= 0) throw new Error("Size must be greater than zero");

  const result = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
};
