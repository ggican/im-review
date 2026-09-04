/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Keep subjects readable in GitHub PR lists.
    "header-max-length": [2, "always", 100],
    // Allow sentence case / kebab in summaries (conventional default is stricter).
    "subject-case": [0],
    "body-max-line-length": [1, "always", 120],
  },
};
