'use strict';

/**
 * Count non-overlapping occurrences of needle in haystack.
 * Returns 0 if needle is empty.
 */
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    count++;
    pos = idx + needle.length;
  }
  return count;
}

/**
 * Detects unbalanced triple backtick fences which can break markdown rendering.
 */
function hasUnbalancedFences(text) {
  const fence = '```';
  let i = 0;
  let count = 0;
  while ((i = text.indexOf(fence, i)) !== -1) {
    count++;
    i += fence.length;
  }
  return count % 2 !== 0;
}

module.exports = {
  countOccurrences,
  hasUnbalancedFences,
};


