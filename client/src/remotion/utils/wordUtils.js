/**
 * Distributes word timings evenly across a segment's duration.
 * @param {{ text: string, start: number, end: number }} segment
 * @returns {{ word: string, startSec: number, endSec: number }[]}
 */
export function distributeWordTimings(segment) {
  const words = segment.text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const duration = segment.end - segment.start
  const wordDur = duration / words.length

  return words.map((word, i) => ({
    word,
    startSec: segment.start + i * wordDur,
    endSec: segment.start + (i + 1) * wordDur,
  }))
}

/**
 * Chunks a flat array of word-timing objects into groups of `size`.
 * @param {{ word: string, startSec: number, endSec: number }[]} words
 * @param {number} size
 * @returns {{ word: string, startSec: number, endSec: number }[][]}
 */
export function chunkWords(words, size = 4) {
  const chunks = []
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size))
  }
  return chunks
}
